import { defineConfig } from "drizzle-kit";
import { cleanDatabaseUrl } from "./db/url";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Ingen .env.local, bruk miljøvariablene som allerede er satt (f.eks. på Render/Vercel).
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // Migreringer går helst direkte mot databasen, ikke via Neon sin pooler.
  dbCredentials: {
    url: cleanDatabaseUrl(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!),
  },
  strict: true,
});
