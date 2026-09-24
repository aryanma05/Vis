import "server-only";

import type { CvViewData } from "@/components/cv/CvView";
import { ACCENTS } from "@/lib/constants";
import type { Profile } from "@/lib/profiles";
import { siteUrl } from "@/lib/site";

// Samler det CV-malene trenger fra profilen: kontaktinfo, CV-oppføringene og de
// festede (eller nyeste) prosjektene.
export function buildCvViewData(profile: Profile): CvViewData {
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
  };
}
