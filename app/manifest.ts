import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vis – din faglige identitet",
    short_name: "Vis",
    description: "Visittkort, CV og prosjekter samlet på én lenke.",
    start_url: "/",
    display: "standalone",
    background_color: "#071a52",
    theme_color: "#071a52",
    lang: "nb",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
