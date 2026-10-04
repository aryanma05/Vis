import { absolute, embedDocument, embedHeaders, embedTheme, escapeHtml } from "@/lib/embed";
import { showsBranding } from "@/lib/pro";
import { getProfileBase } from "@/lib/profiles";
import { getProjectsByOwner } from "@/lib/projects";
import { profilePath, siteUrl } from "@/lib/site";

// Profilkort som andre nettsider kan vise i en iframe (se ShareMenu → «Bygg inn»).
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const theme = embedTheme(new URL(request.url).searchParams.get("tema"));
  const profile = await getProfileBase(username);
  if (!profile) {
    return new Response(embedDocument({ title: "Fant ikke profilen", theme, body: `<div class="card mist">Fant ikke profilen.</div>` }), {
      status: 404,
      headers: embedHeaders(),
    });
  }

  const [all, brand] = await Promise.all([getProjectsByOwner(profile.id, null), showsBranding(profile.id)]);
  const projects = all.slice(0, 3);
  const base = siteUrl();
  const avatar = absolute(profile.image);
  const initials = profile.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const body = `<a class="card" href="${base}${profilePath(profile.username)}" target="_blank" rel="noopener">
  <div class="top">
    ${avatar ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="">` : `<span class="avatar">${escapeHtml(initials)}</span>`}
    <div style="min-width:0">
      <div class="name">${escapeHtml(profile.name)}</div>
      <div class="mist">${escapeHtml([profile.headline, profile.location].filter(Boolean).join(" · ") || `@${profile.username}`)}</div>
    </div>
  </div>
  ${
    projects.length
      ? `<div class="grid">${projects
          .map(
            (p) =>
              `<div>${p.coverImageUrl ? `<img class="shot" src="${escapeHtml(absolute(p.coverImageUrl)!)}" alt="" loading="lazy">` : `<div class="shot"></div>`}<div class="ptitle">${escapeHtml(p.title)}</div></div>`,
          )
          .join("")}</div>`
      : ""
  }
  <div class="foot"><span class="mist">Se hele porteføljen</span>${brand ? `<span class="brand">vis</span>` : ""}</div>
</a>`;
  return new Response(embedDocument({ title: `${profile.name} på Vis`, body, theme }), { headers: embedHeaders() });
}
