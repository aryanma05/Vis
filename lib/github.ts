import "server-only";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import {
  addExternalProjectImages,
  createProject,
  findProjectByGithubRepo,
  getImportedRepoIds,
  MAX_PROJECT_IMAGES,
} from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import { projectInput } from "@/lib/validation";

const API = "https://api.github.com";

/* -------------------------------------------------------------------------- */
/*  Tilgang                                                                   */
/* -------------------------------------------------------------------------- */

// Tokenet brukeren fikk da de logget inn med / koblet til GitHub.
// Null hvis kontoen ikke er koblet til GitHub.
export async function getGithubToken(userId: string): Promise<string | null> {
  const [account] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "github")))
    .limit(1);
  if (!account) return null;

  const tokens = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
  return tokens.accessToken ?? null;
}

export async function hasGithubAccount(userId: string) {
  const [row] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "github")))
    .limit(1);
  return Boolean(row);
}

async function requireGithubToken(userId: string) {
  const token = await getGithubToken(userId);
  if (!token) throw new UserFacingError("Koble til GitHub-kontoen din først.");
  return token;
}

async function gh<T>(path: string, token: string | null, accept = "application/vnd.github+json"): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    headers: {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vis-app",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (res.ok) return (accept.includes("json") ? res.json() : res.text()) as Promise<T>;

  if (res.status === 401) throw new UserFacingError("GitHub-tilgangen har utløpt. Koble til GitHub på nytt.");
  if (res.status === 404) throw new GithubNotFound();
  if (res.status === 403 || res.status === 429) {
    throw new UserFacingError("GitHub begrenser antall forespørsler akkurat nå. Prøv igjen om litt.");
  }
  throw new Error(`GitHub ${res.status} for ${path}`);
}

class GithubNotFound extends UserFacingError {
  constructor() {
    super("Fant ikke repoet på GitHub.");
  }
}

/* -------------------------------------------------------------------------- */
/*  Liste over repoer                                                         */
/* -------------------------------------------------------------------------- */

type ApiRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  private: boolean;
  pushed_at: string | null;
  created_at: string;
  default_branch: string;
  owner: { login: string };
  permissions?: { admin: boolean; push: boolean; pull: boolean };
};

export type RepoSummary = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  fork: boolean;
  archived: boolean;
  pushedAt: string | null;
  alreadyImported: boolean;
};

// Offentlige repoer brukeren eier eller kan pushe til, sist oppdatert først.
export async function listImportableRepos(userId: string): Promise<RepoSummary[]> {
  const token = await requireGithubToken(userId);
  const repos: ApiRepo[] = [];

  for (let page = 1; page <= 3; page++) {
    const batch = await gh<ApiRepo[]>(
      `/user/repos?visibility=public&affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=${page}`,
      token,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  const imported = await getImportedRepoIds(userId);
  return repos
    .filter((r) => !r.private && (r.permissions?.push || r.permissions?.admin))
    .map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      url: r.html_url,
      language: r.language,
      stars: r.stargazers_count,
      fork: r.fork,
      archived: r.archived,
      pushedAt: r.pushed_at,
      alreadyImported: imported.has(r.id),
    }));
}

/* -------------------------------------------------------------------------- */
/*  README: bilder og relative lenker                                         */
/* -------------------------------------------------------------------------- */

// Merker, statistikk-kort og ikoner er ikke skjermbilder av prosjektet.
const NON_SCREENSHOT_HOSTS = [
  "shields.io",
  "badgen.net",
  "badge.fury.io",
  "forthebadge.com",
  "travis-ci.org",
  "travis-ci.com",
  "codecov.io",
  "coveralls.io",
  "circleci.com",
  "app.netlify.com",
  "api.netlify.com",
  "snyk.io",
  "sonarcloud.io",
  "deepscan.io",
  "badges.gitter.im",
  "contrib.rocks",
  "api.star-history.com",
  "starchart.cc",
  "komarev.com",
  "github-readme-stats.vercel.app",
  "skillicons.dev",
  "img.buymeacoffee.com",
  "www.buymeacoffee.com",
  "ko-fi.com",
  "vercel.com",
];

function isLikelyScreenshot(url: URL, attrs = ""): boolean {
  const host = url.hostname.toLowerCase();
  if (NON_SCREENSHOT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".svg") || /badge|shield|logo|icon|avatar|sponsor/.test(path)) return false;
  if (/\/actions\/workflows\//.test(path)) return false;
  // Små bilder med width/height satt i HTML er som regel ikoner.
  const size = /(?:width|height)\s*=\s*["']?(\d+)/i.exec(attrs);
  if (size && Number(size[1]) < 120) return false;
  return true;
}

type RepoRef = { owner: string; repo: string; sha: string; dir: string };

// Gjør relative stier i README-en om til faste GitHub-URL-er (låst til commit-en).
function resolveRepoUrl(href: string, ref: RepoRef, kind: "image" | "link"): string | null {
  const trimmed = href.trim().replace(/^<|>$/g, "");
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("data:")) return null;
  if (/^(mailto|tel):/i.test(trimmed)) return kind === "link" ? trimmed : null;

  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
      const url = new URL(trimmed, "https://github.com");
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      // github.com/o/r/blob/<ref>/fil.png -> raw.githubusercontent.com/o/r/<ref>/fil.png
      const blob = /^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/.exec(url.pathname);
      if (kind === "image" && url.hostname === "github.com" && blob) {
        return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`;
      }
      return url.toString();
    }

    const path = trimmed.startsWith("/") ? trimmed.slice(1) : `${ref.dir}${trimmed}`;
    const base =
      kind === "image"
        ? `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.sha}/`
        : `https://github.com/${ref.owner}/${ref.repo}/blob/${ref.sha}/`;
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

const MD_IMAGE = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const MD_LINK = /(?<!!)\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const MD_REF_DEF = /^(\s{0,3}\[[^\]]+\]:\s*)(\S+)/gm;
const HTML_IMG = /<img\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>/gi;
const HTML_HREF = /(<a\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi;

export function extractReadmeImages(markdown: string, ref: RepoRef) {
  const found: { index: number; url: string; alt: string | null }[] = [];

  for (const m of markdown.matchAll(MD_IMAGE)) {
    const url = resolveRepoUrl(m[2], ref, "image");
    if (url) found.push({ index: m.index!, url, alt: m[1].trim() || null });
  }
  for (const m of markdown.matchAll(HTML_IMG)) {
    const attrs = `${m[1]} ${m[3]}`;
    const url = resolveRepoUrl(m[2], ref, "image");
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1]?.trim() || null;
    if (url && isLikelyScreenshot(new URL(url), attrs)) found.push({ index: m.index!, url, alt });
  }

  const seen = new Set<string>();
  return found
    .sort((a, b) => a.index - b.index)
    .filter(({ url }) => {
      if (seen.has(url) || !isLikelyScreenshot(new URL(url))) return false;
      seen.add(url);
      return true;
    })
    .map(({ url, alt }) => ({ url, alt }));
}

export function absolutizeReadme(markdown: string, ref: RepoRef) {
  return markdown
    .replace(MD_IMAGE, (all, alt, href) => {
      const url = resolveRepoUrl(href, ref, "image");
      return url ? `![${alt}](${url})` : all;
    })
    .replace(MD_LINK, (all, text, href) => {
      const url = resolveRepoUrl(href, ref, "link");
      return url ? `[${text}](${url})` : all;
    })
    .replace(MD_REF_DEF, (all, prefix, href) => {
      const url = resolveRepoUrl(href, ref, /\.(png|jpe?g|gif|webp|avif)$/i.test(href) ? "image" : "link");
      return url ? `${prefix}${url}` : all;
    })
    .replace(HTML_IMG, (all, before, src, after) => {
      const url = resolveRepoUrl(src, ref, "image");
      return url ? `<img${before}src="${url}"${after}>` : all;
    })
    .replace(HTML_HREF, (all, before, href, quote) => {
      const url = resolveRepoUrl(href, ref, "link");
      return url ? `${before}${url}${quote}` : all;
    });
}

// Fjerner en innledende "# repo-navn" siden tittelen vises over beskrivelsen uansett.
function stripLeadingTitle(markdown: string, repoName: string) {
  const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = /^\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/.exec(markdown);
  if (match && simplify(match[1]) === simplify(repoName)) return markdown.slice(match[0].length).trimStart();
  return markdown;
}

// "booking-app" -> "Booking App", "vis" -> "Vis". Navn med store bokstaver beholdes.
export function prettifyRepoName(name: string) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => (word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/*  Import                                                                    */
/* -------------------------------------------------------------------------- */

// Språk GitHub oppdager som sjelden sier noe om hva prosjektet er laget med.
const NOISE_LANGUAGES = new Set([
  "Shell",
  "Batchfile",
  "PowerShell",
  "Makefile",
  "Dockerfile",
  "Procfile",
  "CMake",
  "Nix",
  "Starlark",
  "Jupyter Notebook",
]);

// Emner som sier noe om repoet på GitHub, ikke om hva prosjektet er.
const NOISE_TOPICS = /^(hacktoberfest\d*|good-first-issue|help-wanted|awesome|first-timers-only|open-source|opensource)$/;

const MAX_DESCRIPTION = 20_000;

export type RepoImportDraft = {
  repoId: number;
  fullName: string;
  input: ReturnType<typeof projectInput.parse>;
  images: { url: string; alt: string | null }[];
};

// Henter alt vi trenger fra GitHub og gjør det om til et prosjekt, uten å lagre noe.
export async function buildRepoImport(fullName: string, token: string | null): Promise<RepoImportDraft> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new UserFacingError("Ugyldig reponavn.");

  const repo = await gh<ApiRepo>(`/repos/${fullName}`, token);
  if (repo.private) throw new UserFacingError("Bare offentlige repoer kan importeres.");

  const [languages, readme, sha, ogImage] = await Promise.all([
    gh<Record<string, number>>(`/repos/${repo.full_name}/languages`, token).catch(() => ({})),
    gh<{ content: string; encoding: string; path: string }>(`/repos/${repo.full_name}/readme`, token).catch(
      (e) => {
        if (e instanceof GithubNotFound) return null;
        throw e;
      },
    ),
    gh<string>(`/repos/${repo.full_name}/commits/${repo.default_branch}`, token, "application/vnd.github.sha").catch(
      () => repo.default_branch,
    ),
    token ? fetchCustomSocialImage(repo.full_name, token) : Promise.resolve(null),
  ]);

  const [owner, name] = repo.full_name.split("/");
  const readmePath = readme?.path ?? "README.md";
  const ref: RepoRef = {
    owner,
    repo: name,
    sha: sha.trim(),
    dir: readmePath.includes("/") ? readmePath.slice(0, readmePath.lastIndexOf("/") + 1) : "",
  };

  const rawReadme = readme ? Buffer.from(readme.content, "base64").toString("utf8") : "";
  let description = absolutizeReadme(stripLeadingTitle(rawReadme, repo.name), ref);
  if (description.length > MAX_DESCRIPTION) {
    description = `${description.slice(0, MAX_DESCRIPTION - 80)}\n\n…\n\n[Les hele README-en på GitHub](${repo.html_url}#readme)`;
  }

  const topLanguages = Object.entries(languages)
    .filter(([lang]) => !NOISE_LANGUAGES.has(lang))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lang]) => lang);

  const images = [
    ...(ogImage ? [{ url: ogImage, alt: `${repo.name} forhåndsvisning` }] : []),
    ...extractReadmeImages(rawReadme, ref),
  ].slice(0, MAX_PROJECT_IMAGES);

  const homepage = repo.homepage && /^https?:\/\//i.test(repo.homepage) ? repo.homepage : null;

  const input = projectInput.parse({
    title: prettifyRepoName(repo.name).slice(0, 100),
    summary: repo.description?.trim().slice(0, 200) ?? null,
    description,
    repoUrl: repo.html_url,
    demoUrl: homepage,
    projectDate: repo.created_at.slice(0, 7),
    tags: [...topLanguages, ...(repo.topics ?? []).filter((t) => !NOISE_TOPICS.test(t))].slice(0, 15),
    status: "draft",
  });

  return { repoId: repo.id, fullName: repo.full_name, input, images };
}

// Egendefinert forhåndsbilde satt under repoets innstillinger (ikke GitHubs autogenererte).
async function fetchCustomSocialImage(fullName: string, token: string): Promise<string | null> {
  const [owner, name] = fullName.split("/");
  try {
    const res = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "vis-app" },
      body: JSON.stringify({
        query:
          "query($owner:String!,$name:String!){repository(owner:$owner,name:$name){openGraphImageUrl usesCustomOpenGraphImage}}",
        variables: { owner, name },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    const r = json?.data?.repository;
    return r?.usesCustomOpenGraphImage ? r.openGraphImageUrl : null;
  } catch {
    return null;
  }
}

export async function importGithubRepo(
  userId: string,
  fullName: string,
  { publish = false }: { publish?: boolean } = {},
) {
  const token = await requireGithubToken(userId);

  // Bare repoer brukeren har skrivetilgang til, så ingen kan "låne" andres prosjekter.
  const repo = await gh<ApiRepo>(`/repos/${fullName}`, token);
  if (!repo.permissions?.push && !repo.permissions?.admin) {
    throw new UserFacingError("Du kan bare importere repoer du selv har skrevet til.");
  }

  const existing = await findProjectByGithubRepo(userId, repo.id);
  if (existing) return { projectId: existing, alreadyImported: true };

  const draft = await buildRepoImport(repo.full_name, token);
  let projectId: string;
  try {
    projectId = await createProject(
      userId,
      { ...draft.input, status: publish ? "published" : "draft" },
      { repoId: draft.repoId, fullName: draft.fullName },
    );
  } catch (error) {
    // Samme repo importert to ganger samtidig (f.eks. dobbeltklikk).
    const duplicate = await findProjectByGithubRepo(userId, repo.id);
    if (duplicate) return { projectId: duplicate, alreadyImported: true };
    throw error;
  }
  await addExternalProjectImages(projectId, draft.images);

  return { projectId, alreadyImported: false };
}
