import { ImageResponse } from "next/og";
import { ACCENTS, OPEN_TO_LABELS } from "@/lib/constants";
import { gridBackground, imageDataUrl, OG_COLORS, OG_SIZE, ogFonts, Wordmark } from "@/lib/og";
import { getProfileBase } from "@/lib/profiles";
import { siteHost } from "@/lib/site";
import { shownUsername } from "@/lib/username";

export const alt = "Profil på Vis";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [profile, fonts] = await Promise.all([getProfileBase(decodeURIComponent(username)), ogFonts()]);
  const accent = ACCENTS[profile?.accentColor ?? "is"].color;
  const avatar = await imageDataUrl(profile?.image, { width: 360, height: 360 });
  const initials = (profile?.name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return new ImageResponse(
    (
      <div style={{ ...gridBackground, width: "100%", height: "100%", display: "flex", padding: 72, fontFamily: "Schibsted", color: "#fff" }}>
        <div style={{ position: "absolute", right: -160, top: -160, width: 620, height: 620, borderRadius: 999, background: accent, opacity: 0.18 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <Wordmark size={44} />
          <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
            {avatar ? (
              <img src={avatar} width={240} height={240} alt="" style={{ borderRadius: 64, border: `6px solid ${accent}` }} />
            ) : (
              <div style={{ width: 240, height: 240, borderRadius: 64, background: accent, color: OG_COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, fontWeight: 800 }}>
                {initials}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
              <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>{profile?.name ?? "Vis"}</div>
              {profile && <div style={{ marginTop: 12, fontSize: 32, color: OG_COLORS.mist }}>{`@${shownUsername(profile)}`}</div>}
              {profile?.headline && <div style={{ marginTop: 24, fontSize: 36, lineHeight: 1.25, color: "#fff" }}>{profile.headline.slice(0, 90)}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28, color: OG_COLORS.mist }}>
            {profile?.location && <div style={{ display: "flex" }}>{profile.location}</div>}
            {profile && profile.openTo.length > 0 && (
              <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "rgba(126,240,208,0.15)", color: "#7ef0d0" }}>
                {`Åpen for ${OPEN_TO_LABELS[profile.openTo[0]].toLowerCase()}`}
              </div>
            )}
            <div style={{ display: "flex", marginLeft: "auto" }}>{`${siteHost()}/@${profile?.username ?? ""}`}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
