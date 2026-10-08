import "server-only";

import { lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { jobApplication } = schema;

// Personvern: sletter det som har passert lagringstiden (planlagt jobb, én gang i døgnet).
// P2 fyller inn: expiresAt regnes ut på nytt, lister og kontaktforespørsler ryddes, og
// slettingen logges per bedrift. Til da: den gamle regelen (søknader uendret i et år slettes).

export type RetentionResult = { applications: number; lists: number; contacts: number };

const OLD_RETENTION_MONTHS = 12;

export async function runRetention(): Promise<RetentionResult> {
  const deleted = await db
    .delete(jobApplication)
    .where(lt(jobApplication.updatedAt, sql`now() - make_interval(months => ${OLD_RETENTION_MONTHS})`))
    .returning({ id: jobApplication.id });
  return { applications: deleted.length, lists: 0, contacts: 0 };
}
