import "server-only";

import { absoluteUrl } from "@/lib/api";
import { getCompanyBySlug } from "@/lib/companies";
import { getJob, listCompanyJobs, listOpenJobs } from "@/lib/jobs";
import { getProfileByUsername } from "@/lib/profiles";
import { getProjectById, searchProjects, type ProjectCard } from "@/lib/projects";
import { profilePath, projectPath, siteUrl } from "@/lib/site";

// Formatet til det åpne API-et (v1). Bare det som allerede er offentlig på nettsiden.
// Feltnavnene er på engelsk, som er vanlig for API-er.

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export function projectSummary(p: ProjectCard) {
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    url: `${siteUrl()}${projectPath(p.id)}`,
    coverImage: absoluteUrl(p.coverImageUrl),
    tags: p.tags.map((t) => t.name),
    date: p.projectDate,
    publishedAt: iso(p.publishedAt),
    owner: { username: p.owner.username, name: p.owner.name, url: `${siteUrl()}${profilePath(p.owner.username)}` },
    stats: { views: p.viewCount, reactions: p.reactionCount, comments: p.commentCount },
  };
}

export async function apiProfile(username: string, { withProjects = true } = {}) {
  const profile = await getProfileByUsername(username);
  if (!profile) return null;
  const projects = profile.projects.filter((p) => p.status === "published" && !p.removed);
  return {
    username: profile.username,
    name: profile.name,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    website: profile.websiteUrl,
    avatar: absoluteUrl(profile.image),
    url: `${siteUrl()}${profilePath(profile.username)}`,
    links: profile.links,
    openTo: profile.openTo,
    followers: profile.followers,
    cv: {
      experience: profile.cv.experience.map((e) => ({ title: e.title, organization: e.organization, location: e.location, startDate: e.startDate, endDate: e.endDate, description: e.description })),
      education: profile.cv.education.map((e) => ({ institution: e.institution, degree: e.degree, fieldOfStudy: e.fieldOfStudy, startDate: e.startDate, endDate: e.endDate, description: e.description })),
      skills: profile.cv.skills,
    },
    ...(withProjects ? { projects: projects.map(projectSummary) } : {}),
  };
}

export async function apiProfileProjects(username: string) {
  const profile = await getProfileByUsername(username);
  if (!profile) return null;
  return { data: profile.projects.filter((p) => p.status === "published" && !p.removed).map(projectSummary) };
}

export async function apiProject(id: string) {
  const p = await getProjectById(id, null);
  if (!p || p.status !== "published" || p.removed) return null;
  return {
    ...projectSummary(p),
    description: p.description,
    role: p.role,
    links: { demo: p.demoUrl, repo: p.repoUrl, video: p.videoUrl },
    images: p.images.map((img) => ({ url: absoluteUrl(img.url), alt: img.alt })),
    featured: p.featured,
    updatedAt: iso(p.updatedAt),
  };
}

export async function apiProjects(params: URLSearchParams, limit: number) {
  const q = params.get("q")?.slice(0, 100) ?? "";
  const tag = params.get("tag")?.slice(0, 60) || null;
  const projects = await searchProjects(q, { tag, sort: q ? "relevant" : "newest", limit, featuredOnly: params.get("featured") === "true" });
  return { data: projects.map(projectSummary) };
}

type JobListRow = Awaited<ReturnType<typeof listOpenJobs>>[number];
const jobSummary = (j: JobListRow) => ({
  id: j.id,
  title: j.title,
  url: `${siteUrl()}/stillinger/${j.id}`,
  type: j.type,
  remote: j.remote,
  location: j.location,
  deadline: j.deadline,
  tags: j.tags,
  publishedAt: iso(j.publishedAt),
  company: { name: j.company.name, slug: j.company.slug, url: `${siteUrl()}/bedrift/${j.company.slug}`, logo: absoluteUrl(j.company.logoUrl), verified: Boolean(j.company.verifiedAt) },
});

export async function apiJobs(params: URLSearchParams, limit: number) {
  const jobs = await listOpenJobs({ q: params.get("q")?.slice(0, 100) ?? "", type: params.get("type"), remote: params.get("remote"), limit });
  return { data: jobs.map(jobSummary) };
}

export async function apiJob(id: string) {
  const j = await getJob(id);
  if (!j) return null;
  return {
    id: j.id,
    title: j.title,
    url: `${siteUrl()}/stillinger/${j.id}`,
    open: j.isOpen,
    type: j.type,
    remote: j.remote,
    location: j.location,
    deadline: j.deadline,
    tags: j.tags,
    description: j.description,
    applyUrl: j.isOpen ? `${siteUrl()}/stillinger/${j.id}/sok` : null,
    publishedAt: iso(j.publishedAt),
    company: { name: j.company.name, slug: j.company.slug, url: `${siteUrl()}/bedrift/${j.company.slug}`, logo: absoluteUrl(j.company.logoUrl), verified: Boolean(j.company.verifiedAt) },
  };
}

export async function apiCompany(slug: string) {
  const c = await getCompanyBySlug(slug);
  if (!c) return null;
  const jobs = await listCompanyJobs(c.id);
  return {
    name: c.name,
    slug: c.slug,
    url: `${siteUrl()}/bedrift/${c.slug}`,
    website: c.website,
    logo: absoluteUrl(c.logoUrl),
    about: c.about,
    location: c.location,
    size: c.size,
    verified: Boolean(c.verifiedAt),
    jobs: jobs.map(jobSummary),
  };
}
