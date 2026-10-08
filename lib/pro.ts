import "server-only";

import { randomBytes } from "node:crypto";
import { resolveCname, resolveTxt } from "node:dns/promises";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUserPlan, isPro } from "@/lib/billing";
import { log } from "@/lib/log";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { siteHost } from "@/lib/site";

const { customDomain, profile, profileVisit, user } = schema;

/* -------------------------------------------------------------------------- */
/*  Hvem har sett profilen                                                    */
/* -------------------------------------------------------------------------- */

// Lagres for innloggede besøkende som ikke har skjult seg. Eierens egne besøk telles ikke.
export async function recordProfileVisit(profileUserId: string, viewerId: string | null | undefined) {
  if (!viewerId || viewerId === profileUserId) return;
  const [viewer] = await db.select({ hide: profile.hideVisits }).from(profile).where(eq(profile.userId, viewerId)).limit(1);
  if (viewer?.hide) return;
  await db
    .insert(profileVisit)
    .values({ profileUserId, viewerId })
    .onConflictDoUpdate({
      target: [profileVisit.profileUserId, profileVisit.viewerId],
      set: { visits: sql`${profileVisit.visits} + 1`, lastSeenAt: new Date() },
    });
  // Besøk lagres i 13 måneder (innsikten går ett år tilbake). Ryddes av og til, ikke på hvert besøk.
  if (Math.random() < 0.01) {
    await db.delete(profileVisit).where(lt(profileVisit.lastSeenAt, sql`now() - interval '13 months'`));
  }
}

// Pro ser hvem; alle andre ser bare hvor mange. Den som har skjult seg selv, ser heller ikke andre.
export async function getProfileVisitors(userId: string, days = 30) {
  const since = sql`now() - make_interval(days => ${days})`;
  const [[{ n }], [own], pro] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profileVisit)
      .where(and(eq(profileVisit.profileUserId, userId), gte(profileVisit.lastSeenAt, since))),
    db.select({ hide: profile.hideVisits }).from(profile).where(eq(profile.userId, userId)).limit(1),
    isPro(userId),
  ]);
  const hidden = Boolean(own?.hide);
  if (!pro || hidden) return { count: n, visitors: null, pro, hidden };
  const visitors = await db
    .select({
      name: user.name,
      username: user.username,
      image: user.image,
      headline: profile.headline,
      visits: profileVisit.visits,
      lastSeenAt: profileVisit.lastSeenAt,
    })
    .from(profileVisit)
    .innerJoin(user, eq(user.id, profileVisit.viewerId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(eq(profileVisit.profileUserId, userId), gte(profileVisit.lastSeenAt, since), sql`coalesce(${user.banned}, false) = false`))
    .orderBy(desc(profileVisit.lastSeenAt))
    .limit(100);
  return { count: n, visitors, pro, hidden };
}

/* -------------------------------------------------------------------------- */
/*  Personvern- og Pro-innstillinger                                          */
/* -------------------------------------------------------------------------- */

export async function setProfileFlags(userId: string, flags: { hideVisits?: boolean; hideBranding?: boolean; visibleToCompanies?: boolean }) {
  const set: Partial<typeof profile.$inferInsert> = {};
  if (flags.hideVisits !== undefined) set.hideVisits = flags.hideVisits;
  if (flags.visibleToCompanies !== undefined) {
    set.visibleToCompanies = flags.visibleToCompanies;
    // Lagrede søk hos bedrifter varsler om dem som har blitt synlige siden sist.
    if (flags.visibleToCompanies) {
      const [row] = await db.select({ on: profile.visibleToCompanies }).from(profile).where(eq(profile.userId, userId)).limit(1);
      if (!row?.on) set.visibleSince = new Date();
    }
  }
  if (flags.hideBranding !== undefined) {
    if (flags.hideBranding && !(await isPro(userId))) throw new UserFacingError("Å skjule Vis-merket krever Pro.");
    set.hideBranding = flags.hideBranding;
  }
  if (Object.keys(set).length === 0) return;
  await db.insert(profile).values({ userId, ...set }).onConflictDoUpdate({ target: profile.userId, set });
}

// Skjult merke gjelder bare så lenge personen har Pro.
export async function showsBranding(userId: string) {
  const [row] = await db.select({ hide: profile.hideBranding }).from(profile).where(eq(profile.userId, userId)).limit(1);
  if (!row?.hide) return true;
  return (await getUserPlan(userId)).plan !== "pro";
}

/* -------------------------------------------------------------------------- */
/*  Eget domene                                                               */
/* -------------------------------------------------------------------------- */

const DOMAIN = /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export async function getCustomDomain(userId: string) {
  const [row] = await db.select().from(customDomain).where(eq(customDomain.userId, userId)).limit(1);
  return row ?? null;
}

export async function setCustomDomain(userId: string, input: string) {
  if (!(await isPro(userId))) throw new UserFacingError("Eget domene krever Pro.");
  const domain = normalizeDomain(input);
  if (!DOMAIN.test(domain)) throw new UserFacingError("Skriv domenet slik: dittnavn.no eller portefolje.dittnavn.no.");
  if (domain === siteHost() || domain.endsWith(`.${siteHost()}`) || domain.endsWith(".onrender.com") || domain.endsWith(".vercel.app")) throw new UserFacingError("Bruk et domene du eier selv.");
  const [taken] = await db.select({ userId: customDomain.userId }).from(customDomain).where(eq(customDomain.domain, domain)).limit(1);
  if (taken && taken.userId !== userId) throw new UserFacingError("Domenet er allerede i bruk.");
  const token = randomBytes(12).toString("hex");
  await db.delete(customDomain).where(eq(customDomain.userId, userId));
  await db.insert(customDomain).values({ domain, userId, token });
  return { domain, token };
}

export async function removeCustomDomain(userId: string) {
  await db.delete(customDomain).where(eq(customDomain.userId, userId));
}

// Sjekker TXT-posten _vis.<domene> = vis-verify=<token>, og at domenet peker til appen.
export async function verifyCustomDomain(userId: string) {
  const row = await getCustomDomain(userId);
  if (!row) throw new UserFacingError("Legg inn domenet først.");
  await enforce("domainCheck", userId);
  let txt: string[] = [];
  try {
    txt = (await resolveTxt(`_vis.${row.domain}`)).map((parts) => parts.join(""));
  } catch {
    // Ikke funnet ennå.
  }
  if (!txt.includes(`vis-verify=${row.token}`)) {
    throw new UserFacingError("Fant ikke TXT-posten ennå. Endringer i DNS kan ta opptil en time.");
  }
  let pointsHere = false;
  try {
    pointsHere = (await resolveCname(row.domain)).some((name) => name.replace(/\.$/, "") === siteHost());
  } catch {
    // Rotdomener kan ikke ha CNAME; da må de bruke ALIAS/A-post hos vertsleverandøren.
  }
  await db.update(customDomain).set({ verifiedAt: new Date() }).where(eq(customDomain.domain, row.domain));
  log.info("domain.verified", { userId, domain: row.domain, pointsHere });
  return { pointsHere };
}

// Brukes av proxy.ts: hvilket brukernavn et bekreftet domene hører til. Bare Pro.
export async function usernameForDomain(domain: string) {
  const [row] = await db
    .select({ username: user.username, userId: user.id })
    .from(customDomain)
    .innerJoin(user, eq(user.id, customDomain.userId))
    .where(and(eq(customDomain.domain, normalizeDomain(domain)), sql`${customDomain.verifiedAt} is not null`))
    .limit(1);
  if (!row) return null;
  return (await isPro(row.userId)) ? row.username : null;
}
