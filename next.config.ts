import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/csp";

// Sikkerhetshodere på alle sider. Hva Content-Security-Policy tillater og hvorfor: lib/csp.ts.
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  // Nettleseren skal ikke gjette filtyper.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Andre nettsider får ikke vise Vis i en iframe (hindrer klikk-kapring).
  { key: "X-Frame-Options", value: "DENY" },
  // Lenker ut sender bare domenet vårt, ikke hele adressen (f.eks. /profil/rediger).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Appen trenger ikke kamera, mikrofon eller posisjon.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bilder krympes i nettleseren før opplasting (lib/prepare-image.ts), men serveren
      // tar imot opptil 12 MB i tilfelle det ikke gikk. Litt ekstra for skjemaoverhead.
      // NB: Vercel stopper uansett forespørsler over 4,5 MB.
      bodySizeLimit: "13mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "user-images.githubusercontent.com" },
      { protocol: "https", hostname: "repository-images.githubusercontent.com" },
      { protocol: "https", hostname: "github.com", pathname: "/user-attachments/**" },
    ],
  },
  async headers() {
    return [
      // Alt unntatt innbyggingskortene, som andre nettsider skal kunne vise i en iframe
      // (de setter sine egne sikkerhetshodere, se lib/embed.ts).
      { source: "/((?!bygg-inn/).*)", headers: securityHeaders },
    ];
  },
  async rewrites() {
    return [
      { source: "/@:username", destination: "/profil/:username" },
      { source: "/@:username/:path*", destination: "/profil/:username/:path*" },
    ];
  },
};

export default nextConfig;
