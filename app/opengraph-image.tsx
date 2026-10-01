import { ImageResponse } from "next/og";
import { ogBackground, OG_COLORS, OG_SIZE, ogFonts, Wordmark } from "@/lib/og";

export const alt = "Vis – prosjektene dine, vist frem";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ ...ogBackground, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "Geist", color: "#fff" }}>
        <Wordmark size={52} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 120, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 0.98 }}>Vis frem det</div>
          <div style={{ fontSize: 120, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 0.98 }}>du lager.</div>
          <div style={{ marginTop: 32, fontSize: 32, color: OG_COLORS.mist, fontWeight: 400 }}>Prosjektene, CV-en og lenkene dine på én side.</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
