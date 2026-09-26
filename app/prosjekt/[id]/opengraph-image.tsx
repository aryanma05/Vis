import { ImageResponse } from "next/og";
import { gridBackground, imageDataUrl, OG_COLORS, OG_SIZE, ogFonts, Wordmark } from "@/lib/og";
import { getProjectById } from "@/lib/projects";

export const alt = "Prosjekt på Vis";
export const size = OG_SIZE;
export const contentType = "image/png";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, fonts] = await Promise.all([getProjectById(id), ogFonts()]);
  const [cover, avatar] = await Promise.all([
    imageDataUrl(project?.images[0]?.url, OG_SIZE),
    imageDataUrl(project?.owner.image, { width: 96, height: 96 }),
  ]);

  return new ImageResponse(
    (
      <div style={{ ...gridBackground, width: "100%", height: "100%", display: "flex", fontFamily: "Schibsted", color: "#fff" }}>
        {cover && (
          <img src={cover} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: cover ? "linear-gradient(90deg, rgba(7,26,82,0.97) 0%, rgba(7,26,82,0.9) 45%, rgba(7,26,82,0.45) 100%)" : "transparent",
          }}
        />
        {cover && <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "linear-gradient(180deg, rgba(7,26,82,0) 40%, rgba(7,26,82,0.85) 100%)" }} />}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: 64 }}>
          <Wordmark size={40} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {project && project.tags.length > 0 && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {project.tags.slice(0, 4).map((t) => (
                  <div key={t.slug} style={{ display: "flex", padding: "6px 14px", borderRadius: 10, background: "rgba(255,255,255,0.14)", fontSize: 22 }}>
                    {t.name}
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.98, maxWidth: 1000 }}>{project?.title ?? "Prosjekt på Vis"}</div>
            {project?.summary && <div style={{ marginTop: 18, fontSize: 30, color: OG_COLORS.mist, maxWidth: 950 }}>{project.summary.slice(0, 120)}</div>}
            {project && (
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 30, fontSize: 28 }}>
                {avatar ? (
                  <img src={avatar} width={52} height={52} alt="" style={{ borderRadius: 999 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 999, background: OG_COLORS.ice, color: OG_COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>
                    {initials(project.owner.name)}
                  </div>
                )}
                <div style={{ display: "flex" }}>{project.owner.name}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
