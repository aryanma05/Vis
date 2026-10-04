// Ikke "server-only": filen lastes også fra instrumentation.ts, som ikke kjører i
// React-serverlaget. Den brukes likevel bare på serveren.
import { desc, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { errorEvent } = schema;

export type ErrorSource = "server" | "action" | "client";

type ErrorInput = {
  source: ErrorSource;
  event: string;
  error?: unknown;
  message?: string;
  digest?: string | null;
  path?: string | null;
  userId?: string | null;
};

function describe(error: unknown) {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack ?? null };
  return { message: String(error ?? "Ukjent feil"), stack: null };
}

// Lagrer en feil så den vises for admin. Skal aldri selv kaste eller gjøre en
// forespørsel tregere, så alt skjer i bakgrunnen og feil her svelges.
export function recordError({ source, event, error, message, digest, path, userId }: ErrorInput) {
  if (!process.env.DATABASE_URL) return;
  const described = describe(error);
  void db
    .insert(errorEvent)
    .values({
      source,
      event: event.slice(0, 100),
      message: (message ?? described.message).slice(0, 1000),
      digest: digest?.slice(0, 100) ?? null,
      path: path?.split("?")[0].slice(0, 300) ?? null,
      stack: described.stack?.split("\n").slice(0, 12).join("\n").slice(0, 4000) ?? null,
      userId: userId ?? null,
    })
    .then(() => {
      if (Math.random() < 0.02) {
        return db.delete(errorEvent).where(lt(errorEvent.createdAt, sql`now() - interval '30 days'`));
      }
    })
    .catch(() => {});
}

// Feilene siste døgn/uke, gruppert på melding, til admin.
export async function getErrorSummary(days = 7) {
  const since = sql`now() - make_interval(days => ${days})`;
  const [groups, recent, [totals]] = await Promise.all([
    db
      .select({
        source: errorEvent.source,
        event: errorEvent.event,
        message: errorEvent.message,
        count: sql<number>`count(*)::int`,
        last: sql<Date>`max(${errorEvent.createdAt})`,
        path: sql<string | null>`(array_agg(${errorEvent.path} order by ${errorEvent.createdAt} desc))[1]`,
      })
      .from(errorEvent)
      .where(gte(errorEvent.createdAt, since))
      .groupBy(errorEvent.source, errorEvent.event, errorEvent.message)
      .orderBy(desc(sql`max(${errorEvent.createdAt})`))
      .limit(50),
    db.select().from(errorEvent).orderBy(desc(errorEvent.createdAt)).limit(20),
    db
      .select({
        day: sql<number>`count(*) filter (where ${errorEvent.createdAt} > now() - interval '1 day')::int`,
        week: sql<number>`count(*) filter (where ${errorEvent.createdAt} > now() - interval '7 days')::int`,
      })
      .from(errorEvent),
  ]);
  return { groups, recent, totals };
}
