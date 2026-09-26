import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/profil/rediger", "/varsler", "/innsikt", "/ny", "/velkommen", "/filer/cv/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
