import { absolute, embedDocument, embedHeaders, embedTheme, escapeHtml } from "@/lib/embed";
import { showsBranding } from "@/lib/pro";
import { getProjectById } from "@/lib/projects";
import { projectPath, siteUrl } from "@/lib/site";

// Prosjektkort som andre nettsider kan vise i en iframe.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = embedTheme(new URL(request.url).searchParams.get("tema"));
  const project = await getProjectById(id, null);
  if (!project || project.status !== "published" || project.removed) {
    return new Response(embedDocument({ title: "Fant ikke prosjektet", theme, body: `<div class="card mist">Fant ikke prosjektet.</div>` }), {
      status: 404,
      headers: embedHeaders(),
    });
  }

  const cover = absolute(project.images[0]?.url ?? project.coverImageUrl);
  const brand = await showsBranding(project.owner.id);
  const body = `<a class="card" href="${siteUrl()}${projectPath(project.id)}" target="_blank" rel="noopener">
  ${cover ? `<img class="cover" src="${escapeHtml(cover)}" alt="">` : ""}
  <div class="name" style="margin-top:12px">${escapeHtml(project.title)}</div>
  ${project.summary ? `<div class="mist" style="margin-top:2px">${escapeHtml(project.summary)}</div>` : ""}
  ${project.tags.length ? `<div class="tags">${project.tags.slice(0, 5).map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}</div>` : ""}
  <div class="foot"><span class="mist">av ${escapeHtml(project.owner.name)}</span>${brand ? `<span class="brand">vis</span>` : ""}</div>
</a>`;
  return new Response(embedDocument({ title: `${project.title} på Vis`, body, theme }), { headers: embedHeaders() });
}
