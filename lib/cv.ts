import "server-only";

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { parseCv, type CvFile } from "@/lib/cv-parser";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import type { Tx } from "@/lib/db-types";
import { parsedCv, yearMonth, type ParsedCv } from "@/lib/validation";

const { cvEducation, cvExperience, cvImport, cvSkill, profile, user } = schema;

// Hver import koster penger hos språkmodell-leverandøren.
export const MAX_CV_IMPORTS_PER_DAY = 10;

/* -------------------------------------------------------------------------- */
/*  Lesing                                                                    */
/* -------------------------------------------------------------------------- */

export type Cv = Awaited<ReturnType<typeof getCv>>;

export async function getCv(userId: string) {
  const [experience, education, skills] = await Promise.all([
    db
      .select({
        id: cvExperience.id,
        title: cvExperience.title,
        organization: cvExperience.organization,
        location: cvExperience.location,
        startDate: cvExperience.startDate,
        endDate: cvExperience.endDate,
        description: cvExperience.description,
      })
      .from(cvExperience)
      .where(eq(cvExperience.userId, userId))
      .orderBy(asc(cvExperience.position)),
    db
      .select({
        id: cvEducation.id,
        institution: cvEducation.institution,
        degree: cvEducation.degree,
        fieldOfStudy: cvEducation.fieldOfStudy,
        startDate: cvEducation.startDate,
        endDate: cvEducation.endDate,
        description: cvEducation.description,
      })
      .from(cvEducation)
      .where(eq(cvEducation.userId, userId))
      .orderBy(asc(cvEducation.position)),
    db
      .select({ name: cvSkill.name })
      .from(cvSkill)
      .where(eq(cvSkill.userId, userId))
      .orderBy(asc(cvSkill.position)),
  ]);

  return { experience, education, skills: skills.map((s) => s.name) };
}

/* -------------------------------------------------------------------------- */
/*  Lagring (brukes både av skjemaet og når en import tas i bruk)             */
/* -------------------------------------------------------------------------- */

const entryText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

export const cvInput = z.object({
  experience: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Rolle mangler.").max(150),
        organization: z.string().trim().min(1, "Arbeidsgiver mangler.").max(150),
        location: entryText(100),
        startDate: yearMonth,
        endDate: yearMonth,
        description: entryText(3000),
      }),
    )
    .max(50),
  education: z
    .array(
      z.object({
        institution: z.string().trim().min(1, "Skole/institusjon mangler.").max(150),
        degree: entryText(150),
        fieldOfStudy: entryText(150),
        startDate: yearMonth,
        endDate: yearMonth,
        description: entryText(3000),
      }),
    )
    .max(30),
  skills: z.array(z.string().trim().min(1).max(60)).max(60),
});

export type CvInput = z.output<typeof cvInput>;

async function replaceCv(tx: Tx, userId: string, cv: CvInput) {
  await tx.delete(cvExperience).where(eq(cvExperience.userId, userId));
  await tx.delete(cvEducation).where(eq(cvEducation.userId, userId));
  await tx.delete(cvSkill).where(eq(cvSkill.userId, userId));

  if (cv.experience.length > 0) {
    await tx.insert(cvExperience).values(
      cv.experience.map((e, position) => ({
        userId,
        position,
        title: e.title,
        organization: e.organization,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
    );
  }
  if (cv.education.length > 0) {
    await tx.insert(cvEducation).values(
      cv.education.map((e, position) => ({
        userId,
        position,
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
    );
  }

  const seen = new Set<string>();
  const skills = cv.skills.filter((s) => !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  if (skills.length > 0) {
    await tx.insert(cvSkill).values(skills.map((name, position) => ({ name, userId, position })));
  }
}

// Erstatter hele CV-en. Skjemaet sender alltid alle oppføringene.
export async function saveCv(userId: string, cv: CvInput) {
  await db.transaction((tx) => replaceCv(tx, userId, cv));
}

/* -------------------------------------------------------------------------- */
/*  Import                                                                    */
/* -------------------------------------------------------------------------- */

async function importsLastDay(userId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cvImport)
    .where(and(eq(cvImport.userId, userId), gte(cvImport.createdAt, sql`now() - interval '1 day'`)));
  return count;
}

// Tolker CV-en og lagrer resultatet som et utkast. Ingenting på profilen endres før
// brukeren har sett over utkastet og kalt applyCvImport.
export async function importCv(userId: string, file: CvFile) {
  if ((await importsLastDay(userId)) >= MAX_CV_IMPORTS_PER_DAY) {
    throw new UserFacingError("Du har importert mange CV-er i dag. Prøv igjen i morgen.");
  }

  const base = { userId, fileName: file.name.slice(0, 200), mimeType: file.type.slice(0, 200) || "ukjent" };

  try {
    const result = await parseCv(file);
    const [row] = await db
      .insert(cvImport)
      .values({ ...base, status: "parsed", result })
      .returning({ id: cvImport.id });
    return { importId: row.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(cvImport).values({ ...base, status: "failed", error: message.slice(0, 1000) });
    throw error;
  }
}

export async function getCvImport(userId: string, importId: string) {
  if (!isUuid(importId)) return null;
  const [row] = await db
    .select()
    .from(cvImport)
    .where(and(eq(cvImport.id, importId), eq(cvImport.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { ...row, result: row.result ? parsedCv.parse(row.result) : null };
}

// mode "replace": CV-en erstattes av importen.
// mode "merge": importen legges til etter det som finnes fra før.
// Profilfelter (tittel, bosted, bio, lenker) fylles bare ut der de er tomme.
// `edited` er utkastet slik brukeren har rettet det; ellers brukes det tolkede resultatet.
export async function applyCvImport(
  userId: string,
  importId: string,
  { mode = "replace", edited }: { mode?: "replace" | "merge"; edited?: ParsedCv } = {},
) {
  const imp = await getCvImport(userId, importId);
  if (!imp || imp.status !== "parsed" || !imp.result) {
    throw new UserFacingError("Fant ikke CV-importen, eller den er allerede brukt.");
  }
  const parsed = edited ? parsedCv.parse(edited) : imp.result;

  const incoming = cvInput.parse({
    experience: parsed.experience,
    education: parsed.education,
    skills: parsed.skills,
  });

  await db.transaction(async (tx) => {
    if (mode === "merge") {
      const current = await getCv(userId);
      // Radene slettes og settes inn på nytt, så de gamle id-ene trengs ikke.
      await replaceCv(tx, userId, {
        experience: [...current.experience, ...incoming.experience],
        education: [...current.education, ...incoming.education],
        skills: [...current.skills, ...incoming.skills],
      });
    } else {
      await replaceCv(tx, userId, incoming);
    }

    const [existing] = await tx.select().from(profile).where(eq(profile.userId, userId)).limit(1);
    await tx
      .insert(profile)
      .values({
        userId,
        headline: parsed.headline,
        bio: parsed.summary,
        location: parsed.location,
        links: parsed.links,
      })
      .onConflictDoUpdate({
        target: profile.userId,
        set: {
          headline: existing?.headline || parsed.headline,
          bio: existing?.bio || parsed.summary,
          location: existing?.location || parsed.location,
          links: existing?.links?.length ? existing.links : parsed.links,
        },
      });

    // Navnet fra CV-en brukes bare hvis kontoen mangler et ordentlig navn.
    if (parsed.name) {
      await tx
        .update(user)
        .set({ name: parsed.name })
        .where(and(eq(user.id, userId), sql`coalesce(trim(${user.name}), '') = ''`));
    }

    await tx
      .update(cvImport)
      .set({ status: "applied", appliedAt: new Date() })
      .where(eq(cvImport.id, importId));
  });
}

export async function discardCvImport(userId: string, importId: string) {
  if (!isUuid(importId)) return;
  await db
    .update(cvImport)
    .set({ status: "discarded", result: null })
    .where(and(eq(cvImport.id, importId), eq(cvImport.userId, userId), eq(cvImport.status, "parsed")));
}
