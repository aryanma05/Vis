import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { cleanDatabaseUrl } from "./url";

// Node gir hver adresse til databasen (IPv6 og IPv4 om hverandre) bare 250 ms før den går
// videre. Render har ikke IPv6, så et litt tregt håndtrykk mot Neon, f.eks. rett etter en
// deploy, ga ETIMEDOUT på alle adressene. Med 2 sekunder per adresse kommer tilkoblingen fram.
setDefaultAutoSelectFamilyAttemptTimeout(2000);

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
