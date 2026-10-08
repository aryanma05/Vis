import "server-only";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import {
  addExternalProjectImages,
  addProjectScreenshots,
  createProject,
  findProjectByGithubRepo,
  getImportedRepoIds,
  getProjectById,
  MAX_PROJECT_IMAGES,
  replaceProjectDescription,
} from "@/lib/projects";
import { recordError } from "@/lib/errors";
import { log } from "@/lib/log";
import { UserFacingError } from "@/lib/result";
import { enforce } from "@/lib/rate-limit";
import { projectInput } from "@/lib/validation";

const API = "https://api.github.com";

// Valgfri nøkkel for serveren (en «fine-grained» token uten noen tilganger holder). Den
// brukes til offentlige data når brukeren ikke har koblet til GitHub. Uten den spør vi
// GitHub anonymt, og da deler alle på samme IP-adresse 60 forespørsler i timen. Hos
// Render og andre skytjenester deles IP-adressen med mange andre, så den grensen er som
// regel brukt opp. Derfor trengs GITHUB_TOKEN i produksjon (se README).
const SERVER_TOKEN = process.env.GITHUB_TOKEN?.trim() || null;

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
  let token: string | null = null;
  try {
    token = await getGithubToken(userId);
  } catch (error) {
    log.warn("github.user-token", { error, userId });
    throw new UserFacingError("GitHub-tilgangen har utløpt. Koble til GitHub på nytt.");
  }
  if (!token) throw new UserFacingError("Koble til GitHub-kontoen din først.");
  return token;
}

// Tokenet til brukeren hvis de har koblet til GitHub, ellers ingen (serverens nøkkel brukes da).
async function optionalGithubToken(userId: string | null | undefined) {
  if (!userId) return null;
  try {
    return await getGithubToken(userId);
  } catch {
    return null;
  }
}

class GithubNotFound extends UserFacingError {
  constructor() {
    super("Fant ikke repoet på GitHub.");
  }
}

// Alle nøklene vi har prøvd har nådd grensen hos GitHub. Teksten er en mal som t(), så
// runAction kan oversette den (lib/action.ts).
export class GithubRateLimited extends UserFacingError {
  constructor(
    readonly resetAt: number,
    readonly canLink: boolean,
  ) {
    const n = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
    super(
      canLink
        ? "GitHub tar bare imot et begrenset antall forespørsler, og grensen er nådd akkurat nå. Prøv igjen om {n} min. Kobler du til GitHub-kontoen din, får du din egen grense og slipper å vente."
        : "GitHub tar bare imot et begrenset antall forespørsler, og grensen er nådd akkurat nå. Prøv igjen om {n} min.",
      { n },
    );
    this.name = "GithubRateLimited";
  }
}

type Credential = { kind: "user" | "server" | "anon"; token: string | null };

// Husker nøkler som ikke virker, så vi ikke bruker en forespørsel på dem hver gang.
// `blockedUntil` er når vi prøver igjen (grensen nullstilles, eller etter en stund for
// en ugyldig nøkkel som kan ha blitt byttet ut).
const blocked = { server: 0, anon: 0 };
let serverTokenInvalid = false;
let lastRateLimit: { kind: Credential["kind"]; resetAt: number } | null = null;

function credentialsFor(token: string | null, userOnly: boolean): Credential[] {
  if (userOnly) return token ? [{ kind: "user", token }] : [];
  const list: Credential[] = [];
  if (token) list.push({ kind: "user", token });
  if (SERVER_TOKEN) list.push({ kind: "server", token: SERVER_TOKEN });
  list.push({ kind: "anon", token: null });
  return list;
}

// Grensen er nådd: 429, eller 403 med «x-ratelimit-remaining: 0» eller en melding om
// «secondary rate limit». Gir tidspunktet grensen nullstilles.
async function rateLimitReset(res: Response): Promise<number | null> {
  if (res.status !== 403 && res.status !== 429) return null;
  const remaining = res.headers.get("x-ratelimit-remaining");
  const retryAfter = Number(res.headers.get("retry-after"));
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  let limited = res.status === 429 || remaining === "0" || retryAfter > 0;
  if (!limited) {
    const body = await res
      .clone()
      .text()
      .catch(() => "");
    limited = /rate limit/i.test(body);
  }
  if (!limited) return null;
  if (retryAfter > 0) return Date.now() + retryAfter * 1000;
  if (reset > 0) return reset * 1000;
  return Date.now() + 60_000;
}

export type GhOptions = { accept?: string; userOnly?: boolean };

// Spør GitHub med den beste nøkkelen vi har: brukerens egen (5 000 i timen per bruker),
// så serverens GITHUB_TOKEN (5 000 i timen), og til slutt anonymt (60 i timen per
// IP-adresse). Er en nøkkel ugyldig eller har nådd grensen, prøves neste. `userOnly`
// brukes for /user/…, der svaret gjelder den som eier nøkkelen.
async function gh<T>(path: string, token: string | null, { accept = "application/vnd.github+json", userOnly = false }: GhOptions = {}): Promise<T> {
  let resetAt = Number.POSITIVE_INFINITY;
  let userExpired = false;

  for (const cred of credentialsFor(token, userOnly)) {
    if (cred.kind !== "user" && Date.now() < blocked[cred.kind]) {
      if (cred.kind === "anon" || !serverTokenInvalid) resetAt = Math.min(resetAt, blocked[cred.kind]);
      continue;
    }

    const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      headers: {
        Accept: accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "vis-app",
        ...(cred.token ? { Authorization: `Bearer ${cred.token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (res.ok) {
      if (cred.kind === "server" && serverTokenInvalid) serverTokenInvalid = false;
      return (accept.includes("json") ? res.json() : res.text()) as Promise<T>;
    }

    if (res.status === 401) {
      if (cred.kind === "user") {
        userExpired = true;
        continue;
      }
      if (cred.kind === "server") {
        // Utløpt eller feil GITHUB_TOKEN. Logges som feil, så det vises under /admin → System.
        if (!serverTokenInvalid) {
          const error = new Error("GITHUB_TOKEN er ugyldig eller utløpt. Lag en ny og legg den inn hos Render.");
          log.error("github.server-token", { error });
          recordError({ source: "server", event: "github.server-token", error });
        }
        serverTokenInvalid = true;
        blocked.server = Date.now() + 10 * 60_000;
        continue;
      }
    }

    const reset = await rateLimitReset(res);
    if (reset) {
      lastRateLimit = { kind: cred.kind, resetAt: reset };
      if (cred.kind !== "user") blocked[cred.kind] = reset;
      resetAt = Math.min(resetAt, reset);
      log.warn("github.rate-limit", { kind: cred.kind, path: path.split("?")[0], resetAt: new Date(reset).toISOString() });
      continue;
    }

    if (res.status === 404) throw new GithubNotFound();
    // 451: sperret av GitHub (f.eks. DMCA). 403 uten grense: f.eks. krever SSO.
    if (res.status === 451 || res.status === 403) throw new UserFacingError("GitHub gir ikke tilgang til dette akkurat nå.");
    throw new Error(`GitHub ${res.status} for ${path.split("?")[0]}`);
  }

  if (userOnly && userExpired) throw new UserFacingError("GitHub-tilgangen har utløpt. Koble til GitHub på nytt.");
  if (userOnly && !token) throw new UserFacingError("Koble til GitHub-kontoen din først.");
  throw new GithubRateLimited(Number.isFinite(resetAt) ? resetAt : Date.now() + 60 * 60_000, !token);
}

/* -------------------------------------------------------------------------- */
/*  Mellomlager                                                               */
/* -------------------------------------------------------------------------- */

// Repoer og repolister vi nettopp har hentet. Når noen søker opp et brukernavn og så
// importerer et av repoene, trenger vi ikke spørre GitHub om det samme to ganger.
const REPO_TTL = 10 * 60_000;
const repoCache = new Map<string, { at: number; repo: ApiRepo }>();
const userReposCache = new Map<string, { at: number; repos: ApiRepo[] }>();

function remember<V>(map: Map<string, V>, key: string, value: V) {
  map.set(key, value);
  if (map.size > 500) map.delete(map.keys().next().value!);
}

function cacheRepos(repos: ApiRepo[]) {
  for (const repo of repos) remember(repoCache, repo.full_name.toLowerCase(), { at: Date.now(), repo });
}

async function getRepo(fullName: string, token: string | null, { fresh = false } = {}): Promise<ApiRepo> {
  const hit = repoCache.get(fullName.toLowerCase());
  if (!fresh && hit && Date.now() - hit.at < REPO_TTL) return hit.repo;
  const repo = await gh<ApiRepo>(`/repos/${fullName}`, token);
  cacheRepos([repo]);
  return repo;
}

/* -------------------------------------------------------------------------- */
/*  Status (vises for admin under /admin → System)                            */
/* -------------------------------------------------------------------------- */

export type GithubStatus = {
  token: "missing" | "ok" | "invalid" | "unknown";
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
  anonRemaining: number | null;
  lastRateLimit: { kind: string; resetAt: string } | null;
};

// /rate_limit teller ikke mot grensen, så den er trygg å kalle.
export async function getGithubStatus(): Promise<GithubStatus> {
  type Limits = { resources: { core: { limit: number; remaining: number; reset: number } } };
  const read = async (token: string | null) => {
    const res = await fetch(`${API}/rate_limit`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "vis-app", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (res.status === 401) return "invalid" as const;
    if (!res.ok) return null;
    return ((await res.json()) as Limits).resources.core;
  };

  const [server, anon] = await Promise.all([SERVER_TOKEN ? read(SERVER_TOKEN).catch(() => null) : null, read(null).catch(() => null)]);
  const core = server && server !== "invalid" ? server : null;
  return {
    token: !SERVER_TOKEN ? "missing" : server === "invalid" ? "invalid" : core ? "ok" : "unknown",
    remaining: core?.remaining ?? null,
    limit: core?.limit ?? null,
    resetAt: core ? new Date(core.reset * 1000).toISOString() : null,
    anonRemaining: anon && anon !== "invalid" ? anon.remaining : null,
    lastRateLimit: lastRateLimit ? { kind: lastRateLimit.kind, resetAt: new Date(lastRateLimit.resetAt).toISOString() } : null,
  };
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
  owner: { login: string; avatar_url?: string };
  permissions?: { admin: boolean; push: boolean; pull: boolean };
  forks_count?: number;
  subscribers_count?: number;
  open_issues_count?: number;
  license?: { spdx_id: string | null; name: string } | null;
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
      { userOnly: true },
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  const publicRepos = repos.filter((r) => !r.private);
  cacheRepos(publicRepos);
  const imported = await getImportedRepoIds(userId);
  return publicRepos.filter((r) => r.permissions?.push || r.permissions?.admin).map((r) => toSummary(r, imported));
}

function toSummary(r: ApiRepo, imported: Set<number>): RepoSummary {
  return {
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
  };
}

/* -------------------------------------------------------------------------- */
/*  Offentlige repoer, uten å koble til GitHub                                */
/* -------------------------------------------------------------------------- */

const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const REPO_NAME = /^[\w.-]{1,100}$/;

export type GithubQuery = { kind: "repo"; fullName: string } | { kind: "user"; login: string };

// Forstår «brukernavn», «eier/repo», github.com-lenker (også til undermapper og
// filer) og git@github.com:eier/repo.git.
export function parseGithubInput(input: string): GithubQuery | null {
  const text = input
    .trim()
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/^@/, "");
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)(?:\/([^/?#\s]+))?/i.exec(text);
  const [owner, rawRepo] = url ? [url[1], url[2]] : text.split("/");
  const repo = rawRepo?.replace(/\.git$/i, "");
  if (owner && repo && LOGIN.test(owner) && REPO_NAME.test(repo)) return { kind: "repo", fullName: `${owner}/${repo}` };
  if (owner && !repo && LOGIN.test(owner)) return { kind: "user", login: owner };
  return null;
}

// GitHub-brukernavnet fra en lenke på profilen (github.com/navn), hvis det finnes en.
export function githubLoginFromLinks(links: { url: string }[]): string | null {
  for (const { url } of links) {
    const parsed = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)\/?$/i.exec(url.trim());
    if (parsed && LOGIN.test(parsed[1])) return parsed[1];
  }
  return null;
}

export type GithubLookup =
  | { kind: "user"; login: string; avatar: string | null; repos: RepoSummary[] }
  | { kind: "repo"; repos: RepoSummary[] };

// Søket i «Fra GitHub»: et brukernavn gir de offentlige repoene til brukeren,
// en repo-lenke gir det ene repoet.
export async function lookupGithub(userId: string, input: string): Promise<GithubLookup> {
  await enforce("githubImport", userId);
  const query = parseGithubInput(input);
  if (!query) throw new UserFacingError("Skriv et GitHub-brukernavn eller lim inn en lenke til et repo.");
  const [token, imported] = await Promise.all([optionalGithubToken(userId), getImportedRepoIds(userId)]);

  if (query.kind === "repo") {
    const repo = await getRepo(query.fullName, token);
    if (repo.private) throw new UserFacingError("Repoet er privat. Bare offentlige repoer kan vises på Vis.");
    return { kind: "repo", repos: [toSummary(repo, imported)] };
  }

  const key = query.login.toLowerCase();
  const hit = userReposCache.get(key);
  let repos: ApiRepo[];
  if (hit && Date.now() - hit.at < 5 * 60_000) {
    repos = hit.repos;
  } else {
    try {
      repos = (await gh<ApiRepo[]>(`/users/${query.login}/repos?type=owner&sort=pushed&per_page=100`, token)).filter((r) => !r.private);
    } catch (error) {
      if (error instanceof GithubNotFound) throw new UserFacingError("Fant ingen GitHub-bruker som heter «{login}».", { login: query.login });
      throw error;
    }
    remember(userReposCache, key, { at: Date.now(), repos });
    cacheRepos(repos);
  }
  return {
    kind: "user",
    login: repos[0]?.owner.login ?? query.login,
    avatar: repos[0]?.owner.avatar_url ?? null,
    repos: repos.map((r) => toSummary(r, imported)),
  };
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

// README.md i roten hentes fra raw.githubusercontent.com, som ikke teller mot grensen i
// API-et. Ligger README-en et annet sted eller heter noe annet, spør vi API-et.
async function fetchRawReadme(fullName: string): Promise<{ text: string; path: string } | null> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${fullName}/HEAD/README.md`, {
      headers: { "User-Agent": "vis-app" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return { text: await res.text(), path: "README.md" };
  } catch {
    return null;
  }
}

async function fetchApiReadme(fullName: string, token: string | null): Promise<{ text: string; path: string } | null> {
  try {
    const readme = await gh<{ content: string; path: string }>(`/repos/${fullName}/readme`, token);
    return { text: Buffer.from(readme.content, "base64").toString("utf8"), path: readme.path };
  } catch (error) {
    if (error instanceof GithubNotFound) return null;
    throw error;
  }
}

// README-en som prosjektbeskrivelse: relative bilder og lenker gjøres om til faste
// adresser (låst til siste commit), og en innledende overskrift med reponavnet fjernes.
async function fetchReadme(repo: ApiRepo, token: string | null) {
  const [readme, sha] = await Promise.all([
    fetchRawReadme(repo.full_name).then((raw) => raw ?? fetchApiReadme(repo.full_name, token)),
    gh<string>(`/repos/${repo.full_name}/commits/${encodeURIComponent(repo.default_branch)}`, token, { accept: "application/vnd.github.sha" }).catch(
      () => repo.default_branch,
    ),
  ]);

  const [owner, name] = repo.full_name.split("/");
  const readmePath = readme?.path ?? "README.md";
  const ref: RepoRef = {
    owner,
    repo: name,
    sha: sha.trim(),
    dir: readmePath.includes("/") ? readmePath.slice(0, readmePath.lastIndexOf("/") + 1) : "",
  };

  const raw = readme?.text ?? "";
  let description = absolutizeReadme(stripLeadingTitle(raw, repo.name), ref);
  if (description.length > MAX_DESCRIPTION) {
    description = `${description.slice(0, MAX_DESCRIPTION - 80)}\n\n…\n\n[Les hele README-en på GitHub](${repo.html_url}#readme)`;
  }
  return { raw, description, ref, found: Boolean(readme) };
}

// Henter alt vi trenger fra GitHub og gjør det om til et prosjekt, uten å lagre noe.
export async function buildRepoImport(source: string | ApiRepo, token: string | null): Promise<RepoImportDraft> {
  if (typeof source === "string" && !/^[\w.-]+\/[\w.-]+$/.test(source)) throw new UserFacingError("Ugyldig reponavn.");

  const repo = typeof source === "string" ? await getRepo(source, token) : source;
  if (repo.private) throw new UserFacingError("Bare offentlige repoer kan importeres.");

  const socialToken = token ?? SERVER_TOKEN;
  const [languages, readme, ogImage] = await Promise.all([
    gh<Record<string, number>>(`/repos/${repo.full_name}/languages`, token).catch(() => ({})),
    fetchReadme(repo, token),
    socialToken ? fetchCustomSocialImage(repo.full_name, socialToken) : Promise.resolve(null),
  ]);
  const { raw: rawReadme, description, ref } = readme;

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

// Importerer et offentlig repo som prosjekt. Har brukeren koblet til GitHub, brukes
// tokenet deres (høyere grense hos GitHub), ellers hentes repoet som offentlige data.
export async function importGithubRepo(
  userId: string,
  fullName: string,
  { publish = false }: { publish?: boolean } = {},
) {
  const query = parseGithubInput(fullName);
  if (query?.kind !== "repo") throw new UserFacingError("Ugyldig reponavn.");
  const token = await optionalGithubToken(userId);

  const repo = await getRepo(query.fullName, token);
  if (repo.private) throw new UserFacingError("Bare offentlige repoer kan importeres.");

  const existing = await findProjectByGithubRepo(userId, repo.id);
  if (existing) return { projectId: existing, alreadyImported: true, screenshots: 0 };

  const draft = await buildRepoImport(repo, token);
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
    if (duplicate) return { projectId: duplicate, alreadyImported: true, screenshots: 0 };
    throw error;
  }
  await addExternalProjectImages(projectId, draft.images);

  // Ingen bilder i README-en, men repoet har en nettside: ta skjermbilder av den.
  let screenshots = 0;
  if (draft.images.length === 0 && draft.input.demoUrl) {
    try {
      await enforce("screenshots", userId);
      screenshots = (await addProjectScreenshots(userId, projectId, draft.input.demoUrl)).length;
    } catch (error) {
      log.warn("github.import.screenshots", { error, repo: draft.fullName });
    }
  }

  return { projectId, alreadyImported: false, screenshots };
}

/* -------------------------------------------------------------------------- */
/*  Hent README på nytt                                                       */
/* -------------------------------------------------------------------------- */

// Repoet et prosjekt peker til: det det ble importert fra, eller kode-lenken hvis den går til GitHub.
export function projectRepoName(project: { githubFullName: string | null; repoUrl: string | null }) {
  if (project.githubFullName) return project.githubFullName;
  if (!project.repoUrl || !/github\.com\//i.test(project.repoUrl)) return null;
  const query = parseGithubInput(project.repoUrl);
  return query?.kind === "repo" ? query.fullName : null;
}

// Bytter beskrivelsen med den nyeste README-en i repoet.
export async function syncProjectReadme(userId: string, projectId: string) {
  const project = await getProjectById(projectId, userId);
  if (!project?.isOwner) throw new UserFacingError("Fant ikke prosjektet.");
  const fullName = projectRepoName(project);
  if (!fullName) throw new UserFacingError("Prosjektet er ikke koblet til et repo på GitHub.");

  const token = await optionalGithubToken(userId);
  const repo = await getRepo(fullName, token, { fresh: true });
  if (repo.private) throw new UserFacingError("Repoet er privat.");
  const readme = await fetchReadme(repo, token);
  if (!readme.found) throw new UserFacingError("Repoet har ingen README.");
  await replaceProjectDescription(userId, projectId, readme.description);
  insightCache.delete(repo.full_name.toLowerCase());
}

/* -------------------------------------------------------------------------- */
/*  Repo-info på prosjektsiden                                                */
/* -------------------------------------------------------------------------- */

// Fargene GitHub bruker for de vanligste språkene.
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  "Objective-C": "#438eff",
  Dart: "#00B4AB",
  Go: "#00ADD8",
  Rust: "#dea584",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  HTML: "#e34c26",
  CSS: "#663399",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Astro: "#ff5a03",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  "Jupyter Notebook": "#DA5B0B",
  R: "#198CE7",
  Lua: "#000080",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  Zig: "#ec915c",
  GDScript: "#355570",
  MDX: "#fcb32c",
};
const FALLBACK_COLORS = ["#5eb8d4", "#9fe0a8", "#b9a6ff", "#ffc27a", "#ff9fb5"];

export type RepoInsights = {
  fullName: string;
  url: string;
  cloneUrl: string;
  zipUrl: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  license: string | null;
  archived: boolean;
  fork: boolean;
  defaultBranch: string;
  pushedAt: string | null;
  createdAt: string;
  topics: string[];
  languages: { name: string; percent: number; color: string }[];
  commits: { sha: string; message: string; url: string; date: string | null; author: string; avatar: string | null }[];
  contributors: { login: string; avatar: string; url: string; contributions: number }[];
  release: { tag: string; name: string; url: string; publishedAt: string | null } | null;
};

type ApiCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string; avatar_url: string } | null;
};
type ApiContributor = { login: string; avatar_url: string; html_url: string; contributions: number; type: string };
type ApiRelease = { tag_name: string; name: string | null; html_url: string; published_at: string | null };

// Svarene caches i minnet, så en populær prosjektside ikke bruker opp grensen hos GitHub.
// Feil caches kortere, så siden prøver igjen litt senere.
const insightCache = new Map<string, { at: number; ttl: number; value: Promise<RepoInsights | null> }>();
const INSIGHT_TTL = 30 * 60_000;
const INSIGHT_ERROR_TTL = 5 * 60_000;

export function getRepoInsights(fullName: string): Promise<RepoInsights | null> {
  const key = fullName.toLowerCase();
  const cached = insightCache.get(key);
  if (cached && Date.now() - cached.at < cached.ttl) return cached.value;

  const entry = { at: Date.now(), ttl: INSIGHT_TTL, value: Promise.resolve<RepoInsights | null>(null) };
  entry.value = loadRepoInsights(fullName).catch((error) => {
    log.warn("github.insights", { error, fullName });
    entry.ttl = INSIGHT_ERROR_TTL;
    return null;
  });
  insightCache.set(key, entry);
  if (insightCache.size > 500) insightCache.delete(insightCache.keys().next().value!);
  return entry.value;
}

async function loadRepoInsights(fullName: string): Promise<RepoInsights | null> {
  if (parseGithubInput(fullName)?.kind !== "repo") return null;
  let repo: ApiRepo;
  try {
    repo = await getRepo(fullName, null);
  } catch (error) {
    if (error instanceof GithubNotFound) return null;
    throw error;
  }
  if (repo.private) return null;

  const base = `/repos/${repo.full_name}`;
  const [languages, commits, contributors, release] = await Promise.all([
    gh<Record<string, number>>(`${base}/languages`, null).catch(() => ({})),
    // Tomme repoer svarer 409 her.
    gh<ApiCommit[]>(`${base}/commits?per_page=4`, null).catch(() => []),
    // Store repoer kan svare 202 mens GitHub regner, da kommer det ingen liste.
    gh<ApiContributor[]>(`${base}/contributors?per_page=12`, null).catch(() => []),
    gh<ApiRelease>(`${base}/releases/latest`, null).catch(() => null),
  ]);

  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([name, bytes], i) => ({
    name,
    percent: total ? (bytes / total) * 100 : 0,
    color: LANGUAGE_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));
  const rest = sorted.slice(5).reduce((sum, [, bytes]) => sum + bytes, 0);
  if (total && rest / total >= 0.005) top.push({ name: "Annet", percent: (rest / total) * 100, color: "#8b949e" });

  return {
    fullName: repo.full_name,
    url: repo.html_url,
    cloneUrl: `${repo.html_url}.git`,
    zipUrl: `${repo.html_url}/archive/refs/heads/${encodeURIComponent(repo.default_branch)}.zip`,
    homepage: repo.homepage && /^https?:\/\//i.test(repo.homepage) ? repo.homepage : null,
    stars: repo.stargazers_count,
    forks: repo.forks_count ?? 0,
    watchers: repo.subscribers_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    license: repo.license && repo.license.spdx_id !== "NOASSERTION" ? (repo.license.spdx_id ?? repo.license.name) : null,
    archived: repo.archived,
    fork: repo.fork,
    defaultBranch: repo.default_branch,
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    topics: (repo.topics ?? []).filter((t) => !NOISE_TOPICS.test(t)).slice(0, 8),
    languages: top,
    commits: (Array.isArray(commits) ? commits : []).slice(0, 4).map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0].slice(0, 120),
      url: c.html_url,
      date: c.commit.author?.date ?? null,
      author: c.author?.login ?? c.commit.author?.name ?? "ukjent",
      avatar: c.author?.avatar_url ?? null,
    })),
    contributors: (Array.isArray(contributors) ? contributors : [])
      .filter((c) => c.type !== "Bot")
      .slice(0, 8)
      .map((c) => ({ login: c.login, avatar: c.avatar_url, url: c.html_url, contributions: c.contributions })),
    release: release ? { tag: release.tag_name, name: release.name || release.tag_name, url: release.html_url, publishedAt: release.published_at } : null,
  };
}
