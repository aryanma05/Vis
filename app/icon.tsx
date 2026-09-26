import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Faneikonet: en isblå sirkel med prikken fra ordmerket.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#071a52", borderRadius: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: "#c7f9ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: "#071a52" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
