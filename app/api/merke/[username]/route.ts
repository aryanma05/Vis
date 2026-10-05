import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { escapeHtml, textWidth } from "@/lib/embed";
import { publicProject } from "@/lib/projects";

const { project, user } = schema;

// Merke til README-er: «vis | @brukernavn · 12 prosjekter». Lenken rundt lages av den som
// limer det inn (se ShareMenu).
export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = username.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
  const [row] = await db
    .select({ username: user.username, banned: user.banned, projects: sql<number>`count(${project.id})::int` })
    .from(user)
    .leftJoin(project, and(eq(project.ownerId, user.id), publicProject()))
    .where(eq(user.username, name))
    .groupBy(user.id)
    .limit(1);

  const right = row && !row.banned ? `@${row.username}${row.projects ? ` · ${row.projects} ${row.projects === 1 ? "prosjekt" : "prosjekter"}` : ""}` : "fant ikke profilen";
  const left = "vis";
  const lw = textWidth(left) + 16;
  const rw = textWidth(right) + 16;
  const w = lw + rw;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeHtml(`${left}: ${right}`)}">
<title>${escapeHtml(`${left}: ${right}`)}</title>
<clipPath id="r"><rect width="${w}" height="20" rx="4"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#060b1d"/><rect x="${lw}" width="${rw}" height="20" fill="#4b93ff"/></g>
<g fill="#fff" font-family="Verdana,Geist,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14" text-anchor="middle" font-weight="700" fill="#c7f9ff">${left}</text>
<text x="${lw + rw / 2}" y="14" text-anchor="middle">${escapeHtml(right)}</text>
</g></svg>`;

  return new Response(svg, {
    status: row ? 200 : 404,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // GitHub mellomlagrer bilder; en time er nok til at tallet holder seg ferskt.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
