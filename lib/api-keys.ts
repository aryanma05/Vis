import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";

const { apiKey, user } = schema;

export const MAX_KEYS = 5;

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

// Lager en nøkkel. Selve nøkkelen returneres bare her; vi lagrer bare hashen.
export async function createApiKey(userId: string, name: string) {
  const clean = name.trim().slice(0, 60) || "Min nøkkel";
  const [{ n }] = await db.select({ n: count() }).from(apiKey).where(and(eq(apiKey.userId, userId), isNull(apiKey.revokedAt)));
  if (n >= MAX_KEYS) throw new UserFacingError("Du kan ha opptil {n} aktive nøkler.", { n: MAX_KEYS });
  const key = `vis_${randomBytes(24).toString("base64url")}`;
  await db.insert(apiKey).values({ userId, name: clean, prefix: key.slice(0, 10), keyHash: hash(key) });
  return key;
}

export async function listApiKeys(userId: string) {
  return db
    .select({ id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, lastUsedAt: apiKey.lastUsedAt, createdAt: apiKey.createdAt })
    .from(apiKey)
    .where(and(eq(apiKey.userId, userId), isNull(apiKey.revokedAt)))
    .orderBy(desc(apiKey.createdAt));
}

export async function revokeApiKey(userId: string, id: string) {
  if (!isUuid(id)) return;
  await db.update(apiKey).set({ revokedAt: new Date() }).where(and(eq(apiKey.id, id), eq(apiKey.userId, userId)));
}

// Fra «Authorization: Bearer vis_…». Ugyldige eller tilbakekalte nøkler gir null.
export async function authenticateApiKey(header: string | null) {
  const key = header?.match(/^Bearer\s+(vis_[A-Za-z0-9_-]{20,})$/)?.[1];
  if (!key) return null;
  const [row] = await db
    .select({ id: apiKey.id, userId: apiKey.userId, banned: user.banned })
    .from(apiKey)
    .innerJoin(user, eq(user.id, apiKey.userId))
    .where(and(eq(apiKey.keyHash, hash(key)), isNull(apiKey.revokedAt)))
    .limit(1);
  if (!row || row.banned) return null;
  void db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, row.id)).catch(() => {});
  return row;
}
