import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vis – prosjektene dine, vist frem",
    short_name: "Vis",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#060b1d",
    theme_color: "#060b1d",
    lang: "nb",
    // Logoen har god luft rundt seg, så de samme filene kan beskjæres av telefonen (maskable).
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
