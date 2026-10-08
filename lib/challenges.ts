import "server-only";

import { and, asc, count, desc, eq, gte, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireBusiness, requireCompanyRole } from "@/lib/companies";
import { log } from "@/lib/log";
import { notify } from "@/lib/notifications";
import { getProjectCardsByIds, isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { outer } from "@/lib/sql";

const { challenge, challengeEntry, company, companyMember, project } = schema;

// Utfordringer: bedriften legger ut en liten oppgave («Lag en landingsside for en
// sykkelbutikk»), og folk svarer med et prosjekt på Vis. Rettferdigere enn kodetester,
// fungerer som et lite hackathon, og passer studenter og juniorer. Svarene er prosjekter
// og dermed offentlige; bedriften kan fremheve de beste.

export type ChallengeInput = { title: string; description?: string; reward?: string | null; deadline?: string | null; tags?: string[] };

function clean(input: ChallengeInput) {
  const title = input.title?.trim().slice(0, 120) ?? "";
  if (title.length < 3) throw new UserFacingError("Utfordringen må ha en tittel.");
  const deadline = input.deadline && /^\d{4}-\d{2}-\d{2}$/.test(input.deadline) ? input.deadline : null;
  return {
    title,
    description: input.description?.trim().slice(0, 20_000) ?? "",
    reward: input.reward?.trim().slice(0, 200) || null,
    deadline,
    tags: [...new Set((input.tags ?? []).map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 10),
  };
}

const open = () => and(eq(challenge.status, "published"), or(isNull(challenge.deadline), gte(challenge.deadline, sql`current_date`)))!;

async function getRow(challengeId: string) {
  if (!isUuid(challengeId)) throw new UserFacingError("Fant ikke utfordringen.");
  const [row] = await db.select().from(challenge).where(eq(challenge.id, challengeId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke utfordringen.");
  return row;
}

// Utfordringer krever Bedrift (eget tillegg senere).
export async function createChallenge(userId: string, companyId: string, input: ChallengeInput, publish: boolean) {
  await requireCompanyRole(userId, companyId, ["owner", "admin"]);
  await requireBusiness(companyId);
  const fields = clean(input);
  const [row] = await db
    .insert(challenge)
    .values({ ...fields, companyId, status: publish ? "published" : "draft", publishedAt: publish ? new Date() : null })
    .returning({ id: challenge.id });
  log.info("challenge.create", { userId, companyId, challengeId: row.id, publish });
  return row.id;
}

export async function updateChallenge(userId: string, challengeId: string, input: ChallengeInput) {
  const row = await getRow(challengeId);
  await requireCompanyRole(userId, row.companyId, ["owner", "admin"]);
  await db.update(challenge).set(clean(input)).where(eq(challenge.id, challengeId));
  return row.companyId;
}

export async function setChallengeStatus(userId: string, challengeId: string, status: "draft" | "published" | "closed") {
  const row = await getRow(challengeId);
  await requireCompanyRole(userId, row.companyId, ["owner", "admin"]);
  if (status === "published") await requireBusiness(row.companyId);
  await db
    .update(challenge)
    .set({ status, ...(status === "published" && !row.publishedAt ? { publishedAt: new Date() } : {}) })
    .where(eq(challenge.id, challengeId));
  return row.companyId;
}

export async function deleteChallenge(userId: string, challengeId: string) {
  const row = await getRow(challengeId);
  await requireCompanyRole(userId, row.companyId, ["owner", "admin"]);
  await db.delete(challenge).where(eq(challenge.id, challengeId));
  return row.companyId;
}

/* -------------------------------------------------------------------------- */
/*  Lesing                                                                    */
/* -------------------------------------------------------------------------- */

const listColumns = {
  id: challenge.id,
  title: challenge.title,
  reward: challenge.reward,
  deadline: challenge.deadline,
  tags: challenge.tags,
  status: challenge.status,
  publishedAt: challenge.publishedAt,
  createdAt: challenge.createdAt,
  entries: sql<number>`(select count(*)::int from ${challengeEntry} where ${challengeEntry.challengeId} = ${outer(challenge.id)})`,
  company: { id: company.id, slug: company.slug, name: company.name, logoUrl: company.logoUrl, verifiedAt: company.verifiedAt },
};

export async function listOpenChallenges(limit = 60) {
  return db.select(listColumns).from(challenge).innerJoin(company, eq(company.id, challenge.companyId)).where(open()).orderBy(desc(challenge.publishedAt)).limit(limit);
}

export async function listCompanyChallenges(companyId: string, { includeAll = false } = {}) {
  const conditions: SQL[] = [eq(challenge.companyId, companyId)];
  if (!includeAll) conditions.push(open());
  return db
    .select(listColumns)
    .from(challenge)
    .innerJoin(company, eq(company.id, challenge.companyId))
    .where(and(...conditions))
    .orderBy(asc(sql`case ${challenge.status} when 'published' then 0 when 'draft' then 1 else 2 end`), desc(challenge.createdAt));
}

// Utkast vises bare for bedriften. Lukkede og utgåtte vises med beskjed.
export async function getChallenge(challengeId: string, { asMember = false } = {}) {
  if (!isUuid(challengeId)) return null;
  const [row] = await db.select({ challenge, company }).from(challenge).innerJoin(company, eq(company.id, challenge.companyId)).where(eq(challenge.id, challengeId)).limit(1);
  if (!row) return null;
  if (row.challenge.status === "draft" && !asMember) return null;
  const expired = row.challenge.deadline !== null && row.challenge.deadline < new Date().toISOString().slice(0, 10);
  return { ...row.challenge, company: row.company, isOpen: row.challenge.status === "published" && !expired };
}

// Svarene som prosjektkort, fremhevede først. Prosjekter som er skjult eller fjernet vises ikke.
export async function listEntries(challengeId: string) {
  const rows = await db
    .select({ id: challengeEntry.id, userId: challengeEntry.userId, projectId: challengeEntry.projectId, note: challengeEntry.note, highlighted: challengeEntry.highlighted, createdAt: challengeEntry.createdAt })
    .from(challengeEntry)
    .where(eq(challengeEntry.challengeId, challengeId))
    .orderBy(desc(challengeEntry.highlighted), asc(challengeEntry.createdAt));
  const cards = await getProjectCardsByIds(rows.map((r) => r.projectId));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return rows.flatMap((r) => {
    const card = byId.get(r.projectId);
    return card ? [{ ...r, project: card }] : [];
  });
}

export async function getMyEntry(userId: string | null | undefined, challengeId: string) {
  if (!userId || !isUuid(challengeId)) return null;
  const [row] = await db
    .select({ id: challengeEntry.id, projectId: challengeEntry.projectId, note: challengeEntry.note })
    .from(challengeEntry)
    .where(and(eq(challengeEntry.challengeId, challengeId), eq(challengeEntry.userId, userId)))
    .limit(1);
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Svar                                                                      */
/* -------------------------------------------------------------------------- */

// Svarer med et eget, publisert prosjekt. Ett svar per person; et nytt svar bytter prosjektet.
export async function submitEntry(userId: string, challengeId: string, projectId: string, note?: string | null) {
  const row = await getChallenge(challengeId);
  if (!row) throw new UserFacingError("Fant ikke utfordringen.");
  if (!row.isOpen) throw new UserFacingError("Utfordringen er ikke åpen for svar lenger.");
  if (!isUuid(projectId)) throw new UserFacingError("Velg et prosjekt.");
  const [own] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.ownerId, userId), eq(project.status, "published"), sql`${project.removedAt} is null`))
    .limit(1);
  if (!own) throw new UserFacingError("Velg et av dine publiserte prosjekter.");
  await enforce("challengeEntry", userId);

  const cleanNote = note?.trim().slice(0, 1000) || null;
  const [existing] = await db
    .select({ id: challengeEntry.id })
    .from(challengeEntry)
    .where(and(eq(challengeEntry.challengeId, challengeId), eq(challengeEntry.userId, userId)))
    .limit(1);
  if (existing) {
    await db.update(challengeEntry).set({ projectId, note: cleanNote }).where(eq(challengeEntry.id, existing.id));
    return { id: existing.id, updated: true };
  }
  const [inserted] = await db.insert(challengeEntry).values({ challengeId, userId, projectId, note: cleanNote }).returning({ id: challengeEntry.id });

  // Bedriften får varsel om nye svar.
  const members = await db.select({ userId: companyMember.userId }).from(companyMember).where(eq(companyMember.companyId, row.companyId));
  for (const m of members) {
    await notify({ userId: m.userId, actorId: userId, type: "challenge", projectId, data: { event: "entry", challengeId, challengeTitle: row.title, companyName: row.company.name, companySlug: row.company.slug } });
  }
  return { id: inserted.id, updated: false };
}

export async function withdrawEntry(userId: string, challengeId: string) {
  if (!isUuid(challengeId)) throw new UserFacingError("Fant ikke utfordringen.");
  await db.delete(challengeEntry).where(and(eq(challengeEntry.challengeId, challengeId), eq(challengeEntry.userId, userId)));
}

// Bedriften fremhever et svar. Den som svarte får beskjed første gang.
export async function setEntryHighlighted(viewerId: string, entryId: string, highlighted: boolean) {
  if (!isUuid(entryId)) throw new UserFacingError("Fant ikke svaret.");
  const [row] = await db
    .select({ id: challengeEntry.id, userId: challengeEntry.userId, projectId: challengeEntry.projectId, was: challengeEntry.highlighted, challengeId: challenge.id, title: challenge.title, companyId: challenge.companyId, companyName: company.name, companySlug: company.slug })
    .from(challengeEntry)
    .innerJoin(challenge, eq(challenge.id, challengeEntry.challengeId))
    .innerJoin(company, eq(company.id, challenge.companyId))
    .where(eq(challengeEntry.id, entryId))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke svaret.");
  await requireCompanyRole(viewerId, row.companyId);
  await db.update(challengeEntry).set({ highlighted }).where(eq(challengeEntry.id, entryId));
  if (highlighted && !row.was) {
    await notify({
      userId: row.userId,
      actorId: viewerId,
      type: "challenge",
      projectId: row.projectId,
      data: { event: "highlight", challengeId: row.challengeId, challengeTitle: row.title, companyName: row.companyName, companySlug: row.companySlug },
    });
  }
  return row.challengeId;
}

export async function countOpenChallenges() {
  const [{ n }] = await db.select({ n: count() }).from(challenge).where(open());
  return Number(n);
}
