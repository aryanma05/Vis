import "server-only";

import type { CvViewData } from "@/components/cv/CvView";
import { ACCENTS, isProTemplate, type CvTemplate } from "@/lib/constants";
import type { Locale } from "@/lib/i18n";
import type { Profile } from "@/lib/profiles";
import { siteUrl } from "@/lib/site";

// Samler det CV-malene trenger fra profilen: kontaktinfo, CV-oppføringene og de
// festede (eller nyeste) prosjektene.
export function buildCvViewData(profile: Profile, { branding = true, locale = "nb" }: { branding?: boolean; locale?: Locale } = {}): CvViewData {
  const origin = siteUrl().replace(/^https?:\/\//, "");
  const published = profile.projects.filter((p) => p.status === "published" && !p.removed);
  const pinned = published.filter((p) => p.pinned);
  const projects = (pinned.length > 0 ? pinned : published).slice(0, 4);

  return {
    name: profile.name,
    headline: profile.headline,
    location: profile.location,
    website: profile.websiteUrl,
    profileUrl: `${origin}/@${profile.username}`,
    links: profile.links,
    summary: profile.bio,
    experience: profile.cv.experience,
    education: profile.cv.education,
    skills: profile.cv.skills,
    projects: projects.map((p) => ({ title: p.title, summary: p.summary, tags: p.tags.map((t) => t.name), url: `/prosjekt/${p.id}` })),
    accent: ACCENTS[profile.accentColor ?? "is"].color,
    branding,
    brandHost: origin,
    locale,
  };
}

// Pro-malene vises bare så lenge eieren har Pro; ellers faller CV-en tilbake til Klassisk.
export function effectiveTemplate(template: CvTemplate, ownerIsPro: boolean): CvTemplate {
  return isProTemplate(template) && !ownerIsPro ? "klassisk" : template;
}
