import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireBusiness } from "@/lib/companies";
import { requireCompanyPermission } from "@/lib/company-access";
import { isBlocked } from "@/lib/company-privacy";
import { CONTACT_REASON_LABELS, CONTACT_REASONS, type ContactReason } from "@/lib/constants";
import { log } from "@/lib/log";
import { contactEmail, emailProviderConfigured, sendEmailInBackground } from "@/lib/mailer";
import { notify, resolvePrefs } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { profilePath } from "@/lib/site";

const { company, contactRequest, profile, user } = schema;

export const CONTACT_MIN = 20;
export const CONTACT_MAX = 2000;
// En bedrift kan sende samme kandidat én melding per 30 dager, uansett hvem i bedriften som sender.
export const COMPANY_CONTACT_DAYS = 30;

type Sender = { id: string; name: string; email: string; username: string; emailVerified?: boolean | null };

// «Kontakt meg»: lagrer meldingen, varsler mottakeren og sender den på e-post med
// avsenderens adresse som svaradresse. Mottakerens e-post deles aldri med avsenderen.
// Med companyId sendes den på vegne av bedriften (Bedrift): krever rollen og avtalen,
// telles per bedrift, og den som har blokkert bedriften får samme svar som om de var utilgjengelige.
export async function sendContactRequest(
  sender: Sender,
  recipientId: string,
  input: { reason: string; message: string; companyId?: string | null },
) {
  const reason = (CONTACT_REASONS as readonly string[]).includes(input.reason) ? (input.reason as ContactReason) : "annet";
  const message = input.message.trim().replace(/\n{3,}/g, "\n\n");
  if (message.length < CONTACT_MIN) throw new UserFacingError("Skriv litt mer (minst {n} tegn), så de vet hva det gjelder.", { n: CONTACT_MIN });
  if (message.length > CONTACT_MAX) throw new UserFacingError("Meldingen kan være maks {n} tegn.", { n: CONTACT_MAX });
  if (sender.id === recipientId) throw new UserFacingError("Du kan ikke kontakte deg selv.");
  if (sender.emailVerified === false) throw new UserFacingError("Bekreft e-postadressen din før du kontakter andre.");
  const companyId = input.companyId ?? null;
  if (companyId) {
    await requireCompanyPermission(sender.id, companyId, "candidates.contact");
    await requireBusiness(companyId);
  }

  const [recipient] = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      banned: user.banned,
      contactEnabled: profile.contactEnabled,
      visibleToCompanies: profile.visibleToCompanies,
      prefs: profile.notificationPrefs,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, recipientId))
    .limit(1);
  // Bedrifter kan kontakte dem som er synlige for bedrifter; ellers må «Kontakt meg» være på.
  // Har personen blokkert bedriften, får bedriften det samme svaret (blokkeringen vises aldri).
  const reachable = companyId ? recipient?.visibleToCompanies && !(await isBlocked(recipientId, companyId)) : recipient?.contactEnabled;
  if (!recipient || recipient.banned || !reachable) {
    throw new UserFacingError("Denne personen tar ikke imot meldinger akkurat nå.");
  }
  const [from] = companyId
    ? await db.select({ name: company.name, verifiedAt: company.verifiedAt }).from(company).where(eq(company.id, companyId)).limit(1)
    : [null];

  // Bedrift: én melding per kandidat per 30 dager for hele bedriften. Ellers én per uke fra
  // samme person, så ingen kan mase. Sjekkes før grensen telles, og igjen i transaksjonen.
  const recentContact = async (q: Pick<typeof db, "select"> = db) => {
    const [recent] = await q
      .select({ id: contactRequest.id })
      .from(contactRequest)
      .where(
        and(
          companyId ? eq(contactRequest.companyId, companyId) : eq(contactRequest.senderId, sender.id),
          eq(contactRequest.recipientId, recipientId),
          gte(contactRequest.createdAt, sql`now() - make_interval(days => ${companyId ? COMPANY_CONTACT_DAYS : 7})`),
        ),
      )
      .limit(1);
    if (!recent) return;
    throw new UserFacingError(
      companyId ? "Noen i bedriften har allerede kontaktet denne personen de siste 30 dagene." : "Du har allerede sendt denne personen en melding den siste uken.",
    );
  };
  await recentContact();

  await enforce(companyId ? "companyContact" : "contact", companyId ?? sender.id);

  const created = await db.transaction(async (tx) => {
    if (companyId) {
      // Låst per bedrift og kandidat, så to i bedriften ikke kan sende samtidig.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`contact:${companyId}:${recipientId}`}))`);
      await recentContact(tx);
    }
    const [row] = await tx
      .insert(contactRequest)
      .values({ recipientId, senderId: sender.id, reason, message, companyId })
      .returning({ id: contactRequest.id });
    await notify({ userId: recipientId, actorId: sender.id, type: "contact", data: { contactId: row.id } }, tx);
    if (companyId) {
      await audit({ companyId, actorId: sender.id, action: "candidate.contacted", targetType: "user", targetId: recipientId, subjectUserId: recipientId, meta: { reason } }, tx);
    }
    return row;
  });

  const canEmail = emailProviderConfigured || process.env.NODE_ENV !== "production";
  if (canEmail && recipient.emailVerified && resolvePrefs(recipient.prefs).contact !== false) {
    sendEmailInBackground(
      contactEmail({
        to: recipient.email,
        senderName: from ? `${sender.name} (${from.name})` : sender.name,
        senderEmail: sender.email,
        senderUsername: sender.username,
        reason: CONTACT_REASON_LABELS[reason].toLowerCase(),
        message,
        path: profilePath(sender.username),
        viaCompany: Boolean(from),
        unverifiedCompany: Boolean(from && !from.verifiedAt),
      }),
    );
  }
  log.info("contact.sent", { senderId: sender.id, recipientId, reason, companyId });
  return created.id;
}

// Bare mottakeren (og avsenderen) kan lese meldingen. Mottakeren ser også avsenderens
// e-postadresse, så de kan svare.
export async function getContactRequest(viewerId: string, id: string) {
  if (!isUuid(id)) return null;
  const sender = alias(user, "sender");
  const recipient = alias(user, "recipient");
  const [row] = await db
    .select({
      id: contactRequest.id,
      reason: contactRequest.reason,
      message: contactRequest.message,
      createdAt: contactRequest.createdAt,
      readAt: contactRequest.readAt,
      recipientId: contactRequest.recipientId,
      senderId: contactRequest.senderId,
      sender: { name: sender.name, username: sender.username, image: sender.image, email: sender.email },
      recipient: { name: recipient.name, username: recipient.username },
    })
    .from(contactRequest)
    .innerJoin(sender, eq(sender.id, contactRequest.senderId))
    .innerJoin(recipient, eq(recipient.id, contactRequest.recipientId))
    .where(eq(contactRequest.id, id))
    .limit(1);
  if (!row || (row.recipientId !== viewerId && row.senderId !== viewerId)) return null;

  if (row.recipientId === viewerId && !row.readAt) {
    await db.update(contactRequest).set({ readAt: new Date() }).where(eq(contactRequest.id, id));
  }
  return { ...row, isRecipient: row.recipientId === viewerId };
}

export async function listContactRequests(recipientId: string, limit = 50) {
  const sender = alias(user, "sender");
  return db
    .select({
      id: contactRequest.id,
      reason: contactRequest.reason,
      message: contactRequest.message,
      createdAt: contactRequest.createdAt,
      readAt: contactRequest.readAt,
      sender: { name: sender.name, username: sender.username, image: sender.image },
    })
    .from(contactRequest)
    .innerJoin(sender, eq(sender.id, contactRequest.senderId))
    .where(eq(contactRequest.recipientId, recipientId))
    .orderBy(desc(contactRequest.createdAt))
    .limit(limit);
}
