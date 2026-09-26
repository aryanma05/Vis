import { ImageResponse } from "next/og";
import { gridBackground, OG_COLORS, OG_SIZE, ogFonts, Wordmark } from "@/lib/og";

export const alt = "Vis – din faglige identitet på ett sted";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ ...gridBackground, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "Schibsted", color: "#fff" }}>
        <Wordmark size={52} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.95 }}>Vis deg selv.</div>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.95 }}>
            Vis&nbsp;<span style={{ color: OG_COLORS.ice }}>dine</span>&nbsp;verk.
          </div>
          <div style={{ marginTop: 32, fontSize: 32, color: OG_COLORS.mist, fontWeight: 400 }}>Visittkort, CV og prosjekter – samlet på én lenke.</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
