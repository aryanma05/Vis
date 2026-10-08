import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { MAX_EMPLOYEES, MAX_MEMBERS } from "@/lib/companies";
import { requireCompanyPermission } from "@/lib/company-access";
import { ROLE_ACCESS, ROLE_LABEL, type InviteKind, type InviteStatus } from "@/lib/company-labels";
import { assignableRoles, can, type CompanyRole } from "@/lib/company-permissions";
import type { Tx } from "@/lib/db-types";
import { later } from "@/lib/later";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmailInBackground } from "@/lib/mailer";
import { notify } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";

const { company, companyEmployee, companyInvite, companyMember, notification, user } = schema;

// Invitasjoner til en bedrift: tilgang til administrasjonen (member), teamet på bedriftssiden
// (employee) eller eierskap (owner). Ingen får tilgang eller vises på siden før de har sagt ja.
//
// På @brukernavn går invitasjonen til kontoen (varsel og e-post). På e-post lagres bare sha256 av
// lenken, og svaret er det samme om adressen har en konto eller ikke; den som godtar må være
// logget inn med akkurat den adressen, bekreftet. Gjelder i 7 dager og kan brukes én gang.

export const INVITE_TTL_DAYS = 7;
const TTL = sql`now() + make_interval(days => ${INVITE_TTL_DAYS})`;

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
// 32 byte i base64url er 43 tegn. Alt annet er ikke en lenke vi har laget.
const isToken = (token: unknown): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

const isUniqueViolation = (error: unknown) => {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

// «@kari» og «kari» er brukernavn; noe med @ og et punktum etter er en e-postadresse.
function parseTarget(raw: string): { email: string } | { username: string } {
  const value = String(raw ?? "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    if (value.length > 254) throw new UserFacingError("E-postadressen ser ikke riktig ut.");
    return { email: value.toLowerCase() };
  }
  const username = value.replace(/^@/, "").toLowerCase();
  if (!username || username.includes("@")) throw new UserFacingError("Skriv et brukernavn eller en hel e-postadresse.");
  return { username };
}

// «kari@fjordkode.no» -> «k•••@fjordkode.no»
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain ?? ""}`;
}

// Plasser: medlemmer pluss invitasjoner som venter (for tilgang). For teamet: folk i teamet pluss ventende.
export async function countSeats(companyId: string, kind: "member" | "employee" = "member") {
  const people = kind === "member" ? companyMember : companyEmployee;
  const [[{ used }], [{ pending }]] = await Promise.all([
    db.select({ used: count() }).from(people).where(eq(people.companyId, companyId)),
    db
      .select({ pending: count() })
      .from(companyInvite)
      .where(and(eq(companyInvite.companyId, companyId), eq(companyInvite.kind, kind), eq(companyInvite.status, "pending"), gt(companyInvite.expiresAt, sql`now()`))),
  ]);
  return { used: Number(used), pending: Number(pending), max: kind === "member" ? MAX_MEMBERS : MAX_EMPLOYEES };
}

async function assertSeat(companyId: string, kind: "member" | "employee") {
  const { used, pending, max } = await countSeats(companyId, kind);
  if (used + pending >= max) {
    throw kind === "member"
      ? new UserFacingError("En bedrift kan ha opptil {n} medlemmer. Ventende invitasjoner teller med.", { n: max })
      : new UserFacingError("Et team kan ha opptil {n} personer.", { n: max });
  }
}

async function companyInfo(companyId: string) {
  const [co] = await db
    .select({ id: company.id, name: company.name, slug: company.slug, verifiedAt: company.verifiedAt })
    .from(company)
    .where(eq(company.id, companyId))
    .limit(1);
  if (!co) throw new UserFacingError("Fant ikke bedriften.");
  return co;
}

// Varselet om en invitasjon fjernes når den er besvart, trukket tilbake eller sendt på nytt, så
// ingen trykker på noe som ikke finnes (eller får to like).
async function clearInviteNotice(inviteId: string, tx: Tx | typeof db = db) {
  await tx.delete(notification).where(and(eq(notification.type, "company_invite"), sql`${notification.data}->>'inviteId' = ${inviteId}`));
}

async function verifiedActor(actorId: string) {
  const [actor] = await db.select({ name: user.name, username: user.username, email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, actorId)).limit(1);
  if (!actor?.emailVerified) throw new UserFacingError("Bekreft e-postadressen din før du inviterer andre.");
  return actor;
}

/* -------------------------------------------------------------------------- */
/*  E-posten                                                                  */
/* -------------------------------------------------------------------------- */

type InviteMail = {
  to: string;
  inviter: { name: string; username: string };
  company: { name: string; verifiedAt: Date | null };
  kind: InviteKind;
  role: CompanyRole | null;
  title: string | null;
  path: string;
};

// Alle bedrifts-e-poster er på norsk (språket lagres ikke per bruker ennå).
function sendInviteEmail(mail: InviteMail) {
  if (!emailProviderConfigured && process.env.NODE_ENV === "production") return;
  const by = `${mail.inviter.name} (@${mail.inviter.username})`;
  const unverified = mail.company.verifiedAt ? "" : " Bedriften er ikke bekreftet av Vis ennå, så sjekk at du kjenner avsenderen før du sier ja.";
  const expiry = ` Invitasjonen gjelder i ${INVITE_TTL_DAYS} dager.`;
  const role = mail.role ?? "member";
  const copy =
    mail.kind === "owner"
      ? {
          subject: `${mail.inviter.name} vil gjøre deg til eier av ${mail.company.name} på Vis`,
          intro: `${by} vil overføre eierskapet av ${mail.company.name} til deg. Som eier bestemmer du hvem som har tilgang, abonnementet og om bedriften skal slettes. ${mail.inviter.name} blir administrator.${expiry}`,
          quote: null,
        }
      : mail.kind === "employee"
        ? {
            subject: `${mail.inviter.name} vil vise deg i teamet til ${mail.company.name} på Vis`,
            intro: `${by} inviterte deg til teamet på bedriftssiden til ${mail.company.name}${mail.title ? ` som ${mail.title}` : ""}. Profilen og prosjektene dine vises der bare hvis du sier ja, og det gir ingen tilgang til administrasjonen.${unverified}${expiry}`,
            quote: null,
          }
        : {
            subject: `${mail.inviter.name} inviterte deg til ${mail.company.name} på Vis`,
            intro: `${by} inviterte deg til ${mail.company.name} på Vis som ${ROLE_LABEL[role].toLowerCase()}.${unverified}${expiry}`,
            quote: `Dette får du tilgang til: ${ROLE_ACCESS[role]
              .filter((a) => a.ok)
              .map((a) => a.label.toLowerCase())
              .join(", ")}.`,
          };
  // footer: ikke «fordi du har slått på e-postvarsler»; mottakeren har kanskje ikke konto.
  // Objektet sendes som variabel, så det virker både før og etter at notificationEmail får feltet.
  const email = {
    to: mail.to,
    subject: copy.subject,
    heading: copy.subject,
    intro: copy.intro,
    quote: copy.quote,
    path: mail.path,
    button: "Se invitasjonen",
    footer: `Du får denne e-posten fordi ${by} inviterte deg på Vis. Vil du ikke bli med, kan du se bort fra den; invitasjonen utløper av seg selv.`,
  };
  sendEmailInBackground(notificationEmail(email));
}

/* -------------------------------------------------------------------------- */
/*  Invitere                                                                  */
/* -------------------------------------------------------------------------- */

export type InviteInput = { target: string; kind: "member" | "employee"; role?: CompanyRole | null; title?: string | null };

export async function inviteToCompany(actorId: string, companyId: string, input: InviteInput): Promise<{ id: string }> {
  const actorRole = await requireCompanyPermission(actorId, companyId, "members.invite");
  const kind = input.kind === "employee" ? "employee" : "member";
  const role: CompanyRole | null = kind === "member" ? (input.role ?? "member") : null;
  if (role && !assignableRoles(actorRole).includes(role)) {
    const toAdmin = role === "admin";
    throw new UserFacingError(toAdmin ? "Bare eieren kan gi administratortilgang." : "Rollen din gir ikke tilgang til dette.");
  }
  const title = kind === "employee" ? input.title?.trim().slice(0, 80) || null : null;
  const actor = await verifiedActor(actorId);
  const target = parseTarget(input.target);

  let invitedUserId: string | null = null;
  let email: string | null = null;
  if ("email" in target) {
    // Sjekker ikke om adressen har en konto (eller er med fra før): svaret skal være likt uansett.
    if (target.email === actor.email.toLowerCase()) throw new UserFacingError("Du kan ikke invitere deg selv.");
    email = target.email;
  } else {
    const [found] = await db.select({ id: user.id, banned: user.banned }).from(user).where(eq(user.username, target.username)).limit(1);
    if (!found || found.banned) throw new UserFacingError("Fant ingen med det brukernavnet.");
    if (found.id === actorId) throw new UserFacingError("Du kan ikke invitere deg selv.");
    const people = kind === "member" ? companyMember : companyEmployee;
    const [already] = await db
      .select({ userId: people.userId })
      .from(people)
      .where(and(eq(people.companyId, companyId), eq(people.userId, found.id)))
      .limit(1);
    const access = kind === "member";
    if (already) throw new UserFacingError(access ? "Personen har allerede tilgang til bedriften." : "Personen er allerede i teamet.");
    invitedUserId = found.id;
  }

  await assertSeat(companyId, kind);
  await enforce("companyInvite", companyId);
  if (email) await enforce("inviteEmail", sha256(email));
  const co = await companyInfo(companyId);
  const token = email ? newToken() : null;

  let id: string;
  try {
    id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(companyInvite)
        .values({ companyId, kind, role, title, invitedUserId, email, tokenHash: token ? sha256(token) : null, invitedById: actorId, expiresAt: TTL })
        .returning({ id: companyInvite.id });
      await audit({ companyId, actorId, action: "invite.sent", targetType: "invite", targetId: row.id, subjectUserId: invitedUserId, meta: { kind, role, byEmail: Boolean(email) } }, tx);
      if (invitedUserId) {
        await notify(
          { userId: invitedUserId, actorId, type: "company_invite", data: { event: "invite", inviteId: row.id, inviteKind: kind, role: role ?? undefined, companyName: co.name, companySlug: co.slug } },
          tx,
        );
      }
      return row.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Personen har allerede en invitasjon som venter.");
    throw error;
  }
  log.info("company.invite", { actorId, companyId, inviteId: id, kind, role, byEmail: Boolean(email) });

  later(async () => {
    let to = email;
    if (invitedUserId) {
      const [target] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, invitedUserId)).limit(1);
      to = target?.emailVerified ? target.email : null;
    }
    if (to) sendInviteEmail({ to, inviter: actor, company: co, kind, role, title, path: token ? `/invitasjon/${token}` : "/invitasjoner" });
  });
  return { id };
}

// Eierskap overføres med en invitasjon som den nye eieren må godta. Bare til noen som allerede er
// med, og som har bekreftet e-posten. Eieren blir administrator når den godtas.
export async function createOwnerTransfer(actorId: string, companyId: string, userId: string): Promise<{ id: string }> {
  await requireCompanyPermission(actorId, companyId, "members.grantAdmin");
  if (userId === actorId) throw new UserFacingError("Du er allerede eier.");
  const actor = await verifiedActor(actorId);
  const [target] = await db
    .select({ role: companyMember.role, email: user.email, emailVerified: user.emailVerified, banned: user.banned })
    .from(companyMember)
    .innerJoin(user, eq(user.id, companyMember.userId))
    .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, String(userId))))
    .limit(1);
  if (!target || target.banned) throw new UserFacingError("Personen er ikke med i bedriften.");
  if (!target.emailVerified) throw new UserFacingError("Personen må ha bekreftet e-postadressen sin for å bli eier.");
  await enforce("companyInvite", companyId);
  const co = await companyInfo(companyId);

  const id = await db.transaction(async (tx) => {
    // Bare én overføring om gangen.
    await tx
      .update(companyInvite)
      .set({ status: "revoked", respondedAt: new Date() })
      .where(and(eq(companyInvite.companyId, companyId), eq(companyInvite.kind, "owner"), eq(companyInvite.status, "pending")));
    const [row] = await tx
      .insert(companyInvite)
      .values({ companyId, kind: "owner", invitedUserId: userId, invitedById: actorId, expiresAt: TTL })
      .returning({ id: companyInvite.id });
    await audit({ companyId, actorId, action: "invite.sent", targetType: "invite", targetId: row.id, subjectUserId: userId, meta: { kind: "owner", role: target.role } }, tx);
    await notify({ userId, actorId, type: "company_invite", data: { event: "invite", inviteId: row.id, inviteKind: "owner", companyName: co.name, companySlug: co.slug } }, tx);
    return row.id;
  });
  log.info("company.owner-transfer", { actorId, companyId, userId, inviteId: id });
  later(() => sendInviteEmail({ to: target.email, inviter: actor, company: co, kind: "owner", role: null, title: null, path: "/invitasjoner" }));
  return { id };
}

/* -------------------------------------------------------------------------- */
/*  Lister                                                                    */
/* -------------------------------------------------------------------------- */

export type PendingInvite = Awaited<ReturnType<typeof listPendingInvites>>[number];

// Det som venter på svar, og det som har utløpt de siste 14 dagene (kan sendes på nytt).
// Bare for eier og administratorer.
export async function listPendingInvites(viewerId: string, companyId: string) {
  const viewerRole = await requireCompanyPermission(viewerId, companyId, "members.invite");
  const invitee = alias(user, "invitee");
  const inviter = alias(user, "inviter");
  const rows = await db
    .select({
      id: companyInvite.id,
      kind: companyInvite.kind,
      role: companyInvite.role,
      title: companyInvite.title,
      email: companyInvite.email,
      status: companyInvite.status,
      expiresAt: companyInvite.expiresAt,
      createdAt: companyInvite.createdAt,
      inviteeId: invitee.id,
      inviteeName: invitee.name,
      inviteeUsername: invitee.username,
      inviteeImage: invitee.image,
      inviterName: inviter.name,
    })
    .from(companyInvite)
    .leftJoin(invitee, eq(invitee.id, companyInvite.invitedUserId))
    .leftJoin(inviter, eq(inviter.id, companyInvite.invitedById))
    .where(
      and(
        eq(companyInvite.companyId, companyId),
        or(eq(companyInvite.status, "pending"), and(eq(companyInvite.status, "expired"), gt(companyInvite.expiresAt, sql`now() - interval '14 days'`))),
      ),
    )
    .orderBy(desc(companyInvite.createdAt))
    .limit(100);
  const now = Date.now();
  return rows.map((r) => {
    const expired = r.status === "expired" || r.expiresAt.getTime() <= now;
    return {
      id: r.id,
      kind: r.kind,
      role: r.role,
      title: r.title,
      email: r.email,
      status: (expired ? "expired" : "pending") as InviteStatus,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      invitee: r.inviteeId ? { id: r.inviteeId, name: r.inviteeName!, username: r.inviteeUsername!, image: r.inviteeImage } : null,
      invitedBy: r.inviterName,
      // Invitasjoner til administrator og eierskap styres bare av eieren.
      canManage: r.kind === "owner" || r.role === "admin" ? can(viewerRole, "members.grantAdmin") : true,
    };
  });
}

export type MyInvite = Awaited<ReturnType<typeof listMyInvites>>[number];

// Invitasjoner til meg: til kontoen, eller til e-postadressen min hvis den er bekreftet.
export async function listMyInvites(userId: string) {
  const [me] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1);
  if (!me) return [];
  const inviter = alias(user, "inviter");
  return db
    .select({
      id: companyInvite.id,
      kind: companyInvite.kind,
      role: companyInvite.role,
      title: companyInvite.title,
      expiresAt: companyInvite.expiresAt,
      createdAt: companyInvite.createdAt,
      company: { id: company.id, name: company.name, slug: company.slug, logoUrl: company.logoUrl, verifiedAt: company.verifiedAt },
      inviter: { name: inviter.name, username: inviter.username, image: inviter.image },
    })
    .from(companyInvite)
    .innerJoin(company, eq(company.id, companyInvite.companyId))
    .leftJoin(inviter, eq(inviter.id, companyInvite.invitedById))
    .where(
      and(
        eq(companyInvite.status, "pending"),
        gt(companyInvite.expiresAt, sql`now()`),
        me.emailVerified ? or(eq(companyInvite.invitedUserId, userId), eq(companyInvite.email, me.email.toLowerCase())) : eq(companyInvite.invitedUserId, userId),
      ),
    )
    .orderBy(desc(companyInvite.createdAt))
    .limit(20);
}

export type TokenInvite = NonNullable<Awaited<ReturnType<typeof getInviteByToken>>>;

// Det som vises på /invitasjon/[token]: bedriften, hvem som inviterte, rollen og en maskert
// e-postadresse. Aldri id-en eller hele adressen. viewer sier om den innloggede kan svare:
// match (riktig, bekreftet adresse), unverified (riktig, men ikke bekreftet) eller other.
export async function getInviteByToken(token: string, viewerId?: string | null) {
  if (!isToken(token)) return null;
  const inviter = alias(user, "inviter");
  const [row] = await db
    .select({
      kind: companyInvite.kind,
      role: companyInvite.role,
      title: companyInvite.title,
      email: companyInvite.email,
      status: companyInvite.status,
      expiresAt: companyInvite.expiresAt,
      company: { id: company.id, name: company.name, slug: company.slug, logoUrl: company.logoUrl, verifiedAt: company.verifiedAt },
      inviter: { name: inviter.name, username: inviter.username, image: inviter.image },
    })
    .from(companyInvite)
    .innerJoin(company, eq(company.id, companyInvite.companyId))
    .leftJoin(inviter, eq(inviter.id, companyInvite.invitedById))
    .where(eq(companyInvite.tokenHash, sha256(token)))
    .limit(1);
  if (!row || !row.email) return null;
  const { email, ...rest } = row;
  const status: InviteStatus = row.status === "pending" && row.expiresAt.getTime() <= Date.now() ? "expired" : row.status;
  let viewer: "match" | "unverified" | "other" | null = null;
  if (viewerId) {
    const [me] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, viewerId)).limit(1);
    const same = me?.email.toLowerCase() === email;
    viewer = !me ? null : same ? (me.emailVerified ? "match" : "unverified") : "other";
  }
  return { ...rest, status, emailMasked: maskEmail(email), viewer };
}

/* -------------------------------------------------------------------------- */
/*  Svare                                                                     */
/* -------------------------------------------------------------------------- */

type Ref = { inviteId?: string | null; token?: string | null };

// Finner invitasjonen og sjekker at den er til denne personen: kontoen, eller den bekreftede
// e-postadressen. Med id svarer vi «fant ikke» på alt annet, så ingen kan prøve seg frem.
async function findMine(userId: string, { inviteId, token }: Ref) {
  const where = isToken(token) ? eq(companyInvite.tokenHash, sha256(token)) : inviteId && isUuid(inviteId) ? eq(companyInvite.id, inviteId) : null;
  if (!where) throw new UserFacingError("Fant ikke invitasjonen.");
  const [[row], [me]] = await Promise.all([
    db
      .select({ invite: companyInvite, companyName: company.name, companySlug: company.slug })
      .from(companyInvite)
      .innerJoin(company, eq(company.id, companyInvite.companyId))
      .where(where)
      .limit(1),
    db.select({ email: user.email, emailVerified: user.emailVerified, banned: user.banned }).from(user).where(eq(user.id, userId)).limit(1),
  ]);
  if (!row || !me || me.banned) throw new UserFacingError("Fant ikke invitasjonen.");
  const { invite } = row;
  if (invite.invitedUserId) {
    if (invite.invitedUserId !== userId) throw new UserFacingError("Fant ikke invitasjonen.");
  } else {
    if (!me.emailVerified) throw new UserFacingError("Bekreft e-postadressen din først, så kan du svare på invitasjonen.");
    if (invite.email !== me.email.toLowerCase()) {
      throw new UserFacingError(isToken(token) ? "Invitasjonen ble sendt til en annen e-postadresse." : "Fant ikke invitasjonen.");
    }
  }
  if (invite.status !== "pending" || invite.expiresAt.getTime() <= Date.now()) throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");
  return row;
}

// Godtar i én transaksjon: tar invitasjonen (bare én kan vinne), sjekker plassene på nytt med
// bedriften låst, og legger personen til. For eierskap byttes eier og administrator.
export async function acceptInvite(userId: string, { showOnPage = false, ...ref }: Ref & { showOnPage?: boolean }) {
  const { invite, companyName, companySlug } = await findMine(userId, ref);
  const companyId = invite.companyId;

  await db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from ${company} where ${company.id} = ${companyId} for update`);
    const [claimed] = await tx
      .update(companyInvite)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(and(eq(companyInvite.id, invite.id), eq(companyInvite.status, "pending"), gt(companyInvite.expiresAt, sql`now()`)))
      .returning();
    if (!claimed) throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");

    const [membership] = await tx
      .select({ role: companyMember.role })
      .from(companyMember)
      .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)))
      .limit(1);

    if (claimed.kind === "member") {
      if (membership) throw new UserFacingError("Du har allerede tilgang til bedriften.");
      const [{ n }] = await tx.select({ n: count() }).from(companyMember).where(eq(companyMember.companyId, companyId));
      if (n >= MAX_MEMBERS) throw new UserFacingError("Bedriften har ikke flere ledige plasser. Be dem frigjøre en plass og invitere deg på nytt.");
      await tx.insert(companyMember).values({ companyId, userId, role: claimed.role ?? "member", showOnPage: Boolean(showOnPage), invitedById: claimed.invitedById });
    } else if (claimed.kind === "employee") {
      const [{ n }] = await tx.select({ n: count() }).from(companyEmployee).where(eq(companyEmployee.companyId, companyId));
      if (n >= MAX_EMPLOYEES) throw new UserFacingError("Teamet er fullt. Be bedriften fjerne noen og invitere deg på nytt.");
      await tx.insert(companyEmployee).values({ companyId, userId, title: claimed.title, invitedById: claimed.invitedById }).onConflictDoNothing();
    } else {
      // Eierskap: personen må fortsatt være med, og den som spurte må fortsatt være eier.
      const [inviterRole] = claimed.invitedById
        ? await tx
            .select({ role: companyMember.role })
            .from(companyMember)
            .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, claimed.invitedById)))
            .limit(1)
        : [];
      if (!membership || inviterRole?.role !== "owner") throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");
      await tx.update(companyMember).set({ role: "admin" }).where(and(eq(companyMember.companyId, companyId), eq(companyMember.role, "owner")));
      await tx.update(companyMember).set({ role: "owner" }).where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)));
      await audit({ companyId, actorId: claimed.invitedById, action: "owner.transferred", targetType: "user", targetId: userId, subjectUserId: userId, meta: { from: membership.role } }, tx);
    }

    await audit({ companyId, actorId: userId, action: "invite.accepted", targetType: "invite", targetId: claimed.id, subjectUserId: userId, meta: { kind: claimed.kind, role: claimed.role } }, tx);
    await clearInviteNotice(claimed.id, tx);
    if (claimed.invitedById) {
      await notify(
        { userId: claimed.invitedById, actorId: userId, type: "company_access", data: { event: "accepted", inviteId: claimed.id, inviteKind: claimed.kind, companyName, companySlug } },
        tx,
      );
    }
  });
  log.info("company.invite-accept", { userId, companyId, inviteId: invite.id, kind: invite.kind });
  return { kind: invite.kind, companySlug };
}

// Avslå. Med lenken (token) trengs ingen innlogging: den som har lenken, har e-posten. Er man
// logget inn med en annen konto, står avslaget uten navn i loggen.
export async function declineInvite(userId: string | null, ref: Ref) {
  let row: { id: string; companyId: string; kind: InviteKind; invitedById: string | null; companyName: string; companySlug: string };
  let actorId = userId;
  if (isToken(ref.token)) {
    const [found] = await db
      .select({
        id: companyInvite.id,
        companyId: companyInvite.companyId,
        kind: companyInvite.kind,
        invitedById: companyInvite.invitedById,
        email: companyInvite.email,
        companyName: company.name,
        companySlug: company.slug,
      })
      .from(companyInvite)
      .innerJoin(company, eq(company.id, companyInvite.companyId))
      .where(and(eq(companyInvite.tokenHash, sha256(ref.token)), eq(companyInvite.status, "pending")))
      .limit(1);
    if (!found) throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");
    if (userId) {
      const [me] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1);
      if (!me?.emailVerified || me.email.toLowerCase() !== found.email) actorId = null;
    }
    row = found;
  } else {
    if (!userId) throw new UserFacingError("Fant ikke invitasjonen.");
    const { invite, companyName, companySlug } = await findMine(userId, ref);
    row = { id: invite.id, companyId: invite.companyId, kind: invite.kind, invitedById: invite.invitedById, companyName, companySlug };
  }
  const updated = await db
    .update(companyInvite)
    .set({ status: "declined", respondedAt: new Date() })
    .where(and(eq(companyInvite.id, row.id), eq(companyInvite.status, "pending")))
    .returning({ id: companyInvite.id });
  if (updated.length === 0) throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");
  await clearInviteNotice(row.id);
  await audit({ companyId: row.companyId, actorId, action: "invite.declined", targetType: "invite", targetId: row.id, subjectUserId: actorId, meta: { kind: row.kind } });
  if (actorId && row.invitedById) {
    await notify({
      userId: row.invitedById,
      actorId,
      type: "company_access",
      data: { event: "declined", inviteId: row.id, inviteKind: row.kind, companyName: row.companyName, companySlug: row.companySlug },
    });
  }
  log.info("company.invite-decline", { companyId: row.companyId, inviteId: row.id });
}

/* -------------------------------------------------------------------------- */
/*  Trekke tilbake og sende på nytt                                          */
/* -------------------------------------------------------------------------- */

// Invitasjoner til administrator og eierskap kan bare eieren endre.
async function manageable(actorId: string, inviteId: string) {
  if (!isUuid(inviteId)) throw new UserFacingError("Fant ikke invitasjonen.");
  const [invite] = await db.select().from(companyInvite).where(eq(companyInvite.id, inviteId)).limit(1);
  if (!invite) throw new UserFacingError("Fant ikke invitasjonen.");
  const role = await requireCompanyPermission(actorId, invite.companyId, "members.invite");
  if ((invite.kind === "owner" || invite.role === "admin") && !can(role, "members.grantAdmin")) {
    throw new UserFacingError("Bare eieren kan endre denne invitasjonen.");
  }
  return invite;
}

export async function revokeInvite(actorId: string, inviteId: string) {
  const invite = await manageable(actorId, inviteId);
  const updated = await db
    .update(companyInvite)
    .set({ status: "revoked", respondedAt: new Date() })
    .where(and(eq(companyInvite.id, invite.id), inArray(companyInvite.status, ["pending", "expired"])))
    .returning({ id: companyInvite.id });
  if (updated.length === 0) throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");
  await clearInviteNotice(invite.id);
  await audit({ companyId: invite.companyId, actorId, action: "invite.revoked", targetType: "invite", targetId: invite.id, subjectUserId: invite.invitedUserId, meta: { kind: invite.kind, role: invite.role } });
  return invite.companyId;
}

// Ny lenke (den gamle slutter å virke) og 7 nye dager. Maks én gang per døgn per invitasjon.
export async function resendInvite(actorId: string, inviteId: string) {
  const invite = await manageable(actorId, inviteId);
  if (invite.status !== "pending" && invite.status !== "expired") throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");
  const counted = invite.status === "pending" && invite.expiresAt.getTime() > Date.now();
  if (!counted && invite.kind !== "owner") await assertSeat(invite.companyId, invite.kind);
  const actor = await verifiedActor(actorId);
  await enforce("inviteResend", invite.id);
  await enforce("companyInvite", invite.companyId);
  if (invite.email) await enforce("inviteEmail", sha256(invite.email));
  const co = await companyInfo(invite.companyId);
  const token = invite.email ? newToken() : null;

  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(companyInvite)
        .set({ status: "pending", expiresAt: TTL, ...(token ? { tokenHash: sha256(token) } : {}) })
        .where(and(eq(companyInvite.id, invite.id), inArray(companyInvite.status, ["pending", "expired"])))
        .returning({ id: companyInvite.id });
      if (updated.length === 0) throw new UserFacingError("Invitasjonen er ikke lenger gyldig.");
      await audit({ companyId: invite.companyId, actorId, action: "invite.resent", targetType: "invite", targetId: invite.id, subjectUserId: invite.invitedUserId, meta: { kind: invite.kind } }, tx);
      if (invite.invitedUserId) {
        await clearInviteNotice(invite.id, tx);
        await notify(
          {
            userId: invite.invitedUserId,
            actorId,
            type: "company_invite",
            data: { event: "invite", inviteId: invite.id, inviteKind: invite.kind, role: invite.role ?? undefined, companyName: co.name, companySlug: co.slug },
          },
          tx,
        );
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Personen har allerede en invitasjon som venter.");
    throw error;
  }

  later(async () => {
    let to = invite.email;
    if (invite.invitedUserId) {
      const [target] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, invite.invitedUserId)).limit(1);
      to = target?.emailVerified ? target.email : null;
    }
    if (to) sendInviteEmail({ to, inviter: actor, company: co, kind: invite.kind, role: invite.role, title: invite.title, path: token ? `/invitasjon/${token}` : "/invitasjoner" });
  });
  return invite.companyId;
}

// Planlagt jobb: markerer utløpte invitasjoner og sletter besvarte og utløpte som er eldre enn
// 90 dager. Gir antall som ble endret.
export async function expireInvites(): Promise<number> {
  const expired = await db
    .update(companyInvite)
    .set({ status: "expired" })
    .where(and(eq(companyInvite.status, "pending"), lte(companyInvite.expiresAt, sql`now()`)))
    .returning({ id: companyInvite.id });
  const purged = await db
    .delete(companyInvite)
    .where(and(ne(companyInvite.status, "pending"), lt(sql`coalesce(${companyInvite.respondedAt}, ${companyInvite.expiresAt})`, sql`now() - interval '90 days'`)))
    .returning({ id: companyInvite.id });
  return expired.length + purged.length;
}
