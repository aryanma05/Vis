// Slår opp hvilken profil et eget domene hører til. Brukes av proxy.ts, som kjører før
// sidene, og importerer derfor ingen moduler som krever React-serverlaget ("server-only").
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { siteHost } from "@/lib/site";

const cache = new Map<string, { username: string | null; at: number }>();
const TTL = 5 * 60_000;

// Adresser appen selv kjører på. Da trengs ingen oppslag.
export function isOwnHost(host: string) {
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (host.endsWith(".onrender.com") || host.endsWith(".vercel.app")) return true;
  const own = [siteHost(), process.env.RENDER_EXTERNAL_HOSTNAME, process.env.VERCEL_URL].filter(Boolean).map((h) => h!.split(":")[0].toLowerCase());
  return own.includes(host) || own.includes(host.replace(/^www\./, ""));
}

export async function usernameForHost(host: string): Promise<string | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL) return hit.username;

  // Bekreftet domene, og eieren har Pro (aktivt abonnement eller gitt av admin).
  const rows = await db.execute<{ username: string }>(sql`
    select u.username from custom_domain d
    join "user" u on u.id = d.user_id
    where d.domain = ${host} and d.verified_at is not null and coalesce(u.banned, false) = false
      and (
        exists (select 1 from subscription s where s.owner_type = 'user' and s.owner_id = u.id
                and s.status in ('active', 'trialing', 'past_due')
                and (s.current_period_end is null or s.current_period_end > now() - interval '3 days'))
        or exists (select 1 from plan_grant g where g.owner_type = 'user' and g.owner_id = u.id
                and (g.until is null or g.until > now()))
      )
    limit 1`);
  const username = rows[0]?.username ?? null;
  if (cache.size > 2000) cache.clear();
  cache.set(host, { username, at: Date.now() });
  return username;
}
