import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bilder og CV-er er maks 4 MB. Vercel stopper uansett forespørsler over 4,5 MB.
      bodySizeLimit: "4.5mb",
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
  async rewrites() {
    return [{ source: "/@:username", destination: "/profil/:username" }];
  },
};

export default nextConfig;
