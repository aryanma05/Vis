import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { cleanDatabaseUrl } from "./url";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL mangler. Se .env.example.");
}

// Gjenbruk tilkoblingen mellom hot reloads i utvikling.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

// prepare: false fordi Neon sin pooler (pgbouncer) ikke støtter prepared statements.
const client =
  globalForDb.client ?? postgres(cleanDatabaseUrl(connectionString), { prepare: false, max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
