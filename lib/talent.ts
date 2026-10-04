import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireBusiness, requireCompanyRole } from "@/lib/companies";
import { FIELDS, OPEN_TO, type FieldKey, type OpenTo } from "@/lib/constants";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import { profilePath, siteUrl } from "@/lib/site";
import { outer } from "@/lib/sql";

const { cvSkill, profile, project, talentList, talentListMember, user } = schema;

// Kandidatsøk for bedrifter med Bedrift-abonnement. Bare folk som selv har slått på
// «Synlig for bedrifter» kommer med, og bare det som allerede står offentlig på profilen.

export type CandidateFilters = { q?: string; location?: string | null; openTo?: OpenTo | null; field?: FieldKey | null };

const candidateColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  image: user.image,
  headline: profile.headline,
  location: profile.location,
  openTo: profile.openTo,
  skills: sql<string[]>`coalesce((select array_agg(${cvSkill.name} order by ${cvSkill.position}) from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)}), '{}')`,
  projects: sql<number>`(select count(*)::int from ${project} where ${project.ownerId} = ${outer(user.id)} and ${project.status} = 'published' and ${project.removedAt} is null)`,
};

export async function searchCandidates(viewerId: string, companyId: string, filters: CandidateFilters, limit = 50) {
  await requireCompanyRole(viewerId, companyId);
  await requireBusiness(companyId);

  const conditions: SQL[] = [eq(profile.visibleToCompanies, true), sql`coalesce(${user.banned}, false) = false`];
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    conditions.push(
      or(
        ilike(user.name, like),
        ilike(profile.headline, like),
        ilike(profile.bio, like),
        sql`exists (select 1 from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)} and ${cvSkill.name} ilike ${like})`,
      )!,
    );
  }
  if (filters.location?.trim()) conditions.push(ilike(profile.location, `%${filters.location.trim().replace(/[%_]/g, "")}%`));
  if (filters.openTo && OPEN_TO.includes(filters.openTo)) conditions.push(sql`${profile.openTo} @> ${JSON.stringify([filters.openTo])}::jsonb`);
  if (filters.field && FIELDS[filters.field]) {
    const words = FIELDS[filters.field].words;
    conditions.push(
      or(
        ...words.map((w) => ilike(profile.headline, `%${w}%`)),
        sql`exists (select 1 from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)} and (${sql.join(
          words.map((w) => sql`${cvSkill.name} ilike ${`%${w}%`}`),
          sql` or `,
        )}))`,
      )!,
    );
  }

  return db
    .select(candidateColumns)
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(candidateColumns.projects), asc(user.name))
    .limit(Math.min(limit, 100));
}

/* -------------------------------------------------------------------------- */
/*  Lister                                                                    */
/* -------------------------------------------------------------------------- */

export async function listTalentLists(viewerId: string, companyId: string) {
  await requireCompanyRole(viewerId, companyId);
  return db
    .select({
      id: talentList.id,
      name: talentList.name,
      createdAt: talentList.createdAt,
      members: sql<number>`(select count(*)::int from ${talentListMember} where ${talentListMember.listId} = ${talentList.id})`,
    })
    .from(talentList)
    .where(eq(talentList.companyId, companyId))
    .orderBy(desc(talentList.createdAt));
}

export async function createTalentList(viewerId: string, companyId: string, name: string) {
  await requireCompanyRole(viewerId, companyId);
  await requireBusiness(companyId);
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new UserFacingError("Listen må ha et navn.");
  const [{ n }] = await db.select({ n: count() }).from(talentList).where(eq(talentList.companyId, companyId));
  if (n >= 100) throw new UserFacingError("Dere kan ha opptil 100 lister.");
  const [row] = await db.insert(talentList).values({ companyId, name: clean }).returning({ id: talentList.id });
  return row.id;
}

async function listCompany(listId: string) {
  if (!isUuid(listId)) throw new UserFacingError("Fant ikke listen.");
  const [row] = await db.select({ companyId: talentList.companyId, name: talentList.name }).from(talentList).where(eq(talentList.id, listId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke listen.");
  return row;
}

export async function deleteTalentList(viewerId: string, listId: string) {
  const { companyId } = await listCompany(listId);
  await requireCompanyRole(viewerId, companyId, ["owner", "admin"]);
  await db.delete(talentList).where(eq(talentList.id, listId));
  return companyId;
}

export async function setTalentListMember(viewerId: string, listId: string, userId: string, on: boolean, note?: string | null) {
  const { companyId } = await listCompany(listId);
  await requireCompanyRole(viewerId, companyId);
  await requireBusiness(companyId);
  if (!on) {
    await db.delete(talentListMember).where(and(eq(talentListMember.listId, listId), eq(talentListMember.userId, userId)));
    return companyId;
  }
  // Bare kandidater som er synlige for bedrifter kan legges til.
  const [visible] = await db
    .select({ id: profile.userId })
    .from(profile)
    .where(and(eq(profile.userId, userId), eq(profile.visibleToCompanies, true)))
    .limit(1);
  if (!visible) throw new UserFacingError("Denne personen er ikke synlig for bedrifter.");
  await db
    .insert(talentListMember)
    .values({ listId, userId, note: note?.trim().slice(0, 500) || null })
    .onConflictDoUpdate({ target: [talentListMember.listId, talentListMember.userId], set: { note: note?.trim().slice(0, 500) || null } });
  return companyId;
}

export async function getTalentList(viewerId: string, listId: string) {
  const list = await listCompany(listId);
  await requireCompanyRole(viewerId, list.companyId);
  const members = await db
    .select({ ...candidateColumns, note: talentListMember.note, addedAt: talentListMember.addedAt, visible: profile.visibleToCompanies })
    .from(talentListMember)
    .innerJoin(user, eq(user.id, talentListMember.userId))
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(eq(talentListMember.listId, listId))
    .orderBy(desc(talentListMember.addedAt));
  // Har noen slått av «Synlig for bedrifter» etterpå, vises de ikke lenger.
  return { id: listId, name: list.name, companyId: list.companyId, members: members.filter((m) => m.visible) };
}

// Hvilke lister kandidatene allerede står i (til «Legg i liste»-knappen).
export async function listMembershipsFor(companyId: string, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select({ userId: talentListMember.userId, listId: talentListMember.listId })
    .from(talentListMember)
    .innerJoin(talentList, eq(talentList.id, talentListMember.listId))
    .where(and(eq(talentList.companyId, companyId), inArray(talentListMember.userId, userIds)));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), r.listId]);
  return map;
}

const csvCell = (value: unknown) => {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  // Hindrer at regneark tolker celler som formler («=HYPERLINK(...)»).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

// Eksport av en liste til CSV (Excel/Numbers/Google Sheets). Ingen e-postadresser.
export async function talentListCsv(viewerId: string, listId: string) {
  const list = await getTalentList(viewerId, listId);
  await requireBusiness(list.companyId);
  const header = ["Navn", "Brukernavn", "Profil", "Tittel", "Sted", "Ferdigheter", "Prosjekter", "Notat", "Lagt til"];
  const rows = list.members.map((m) => [
    m.name,
    m.username,
    `${siteUrl()}${profilePath(m.username)}`,
    m.headline,
    m.location,
    m.skills.slice(0, 15),
    m.projects,
    m.note,
    new Date(m.addedAt).toISOString().slice(0, 10),
  ]);
  // BOM så Excel leser æ, ø og å riktig.
  return { name: list.name, csv: `﻿${[header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n")}\r\n` };
}
