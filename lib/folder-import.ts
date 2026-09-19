// Leser en prosjektmappe i nettleseren og lager et prosjektutkast av den.
// Selve koden lastes aldri opp: vi leser README, manifestfiler (package.json osv.)
// og finner skjermbilder. Bare klient.

export type FolderEntry = { path: string; size: number | null; getFile: () => Promise<File> };

export type FolderImage = { path: string; file: File; fromReadme: boolean };

export type FolderDraft = {
  title: string;
  summary: string;
  description: string;
  readmeDir: string;
  tags: string[];
  repoUrl: string;
  demoUrl: string;
  images: FolderImage[];
  fileCount: number;
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  ".expo",
  ".cache",
  ".gradle",
  ".idea",
  ".vscode",
  ".dart_tool",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  "target",
  "Pods",
  "DerivedData",
  "venv",
  ".venv",
  "env",
  "__pycache__",
  "bin",
  "obj",
]);

const MAX_ENTRIES = 8000;
const MAX_DEPTH = 8;
export const MAX_FOLDER_IMAGES = 8;

const isSkipped = (path: string) => path.split("/").some((part) => SKIP_DIRS.has(part));

/* -------------------------------------------------------------------------- */
/*  Samle filer (dra-og-slipp, mappevelger eller <input webkitdirectory>)     */
/* -------------------------------------------------------------------------- */

// Fra dra-og-slipp. Går gjennom mappene selv, så node_modules aldri leses.
export async function entriesFromDrop(item: DataTransferItem): Promise<{ root: string; entries: FolderEntry[] } | null> {
  const root = item.webkitGetAsEntry?.();
  if (!root?.isDirectory) return null;
  const entries: FolderEntry[] = [];

  async function walk(dir: FileSystemDirectoryEntry, prefix: string, depth: number) {
    if (depth > MAX_DEPTH || entries.length >= MAX_ENTRIES) return;
    const reader = dir.createReader();
    const children: FileSystemEntry[] = [];
    // readEntries gir filene i porsjoner; les til den returnerer en tom liste.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      children.push(...batch);
    }
    for (const child of children) {
      const path = prefix ? `${prefix}/${child.name}` : child.name;
      if (child.isDirectory) {
        if (!SKIP_DIRS.has(child.name)) await walk(child as FileSystemDirectoryEntry, path, depth + 1);
      } else if (entries.length < MAX_ENTRIES) {
        const fileEntry = child as FileSystemFileEntry;
        entries.push({ path, size: null, getFile: () => new Promise((res, rej) => fileEntry.file(res, rej)) });
      }
    }
  }

  await walk(root as FileSystemDirectoryEntry, "", 0);
  return { root: root.name, entries };
}

type DirectoryHandle = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

// Fra showDirectoryPicker (Chrome/Edge).
export async function entriesFromHandle(handle: FileSystemDirectoryHandle): Promise<{ root: string; entries: FolderEntry[] }> {
  const entries: FolderEntry[] = [];

  async function walk(dir: DirectoryHandle, prefix: string, depth: number) {
    if (depth > MAX_DEPTH || entries.length >= MAX_ENTRIES) return;
    for await (const child of dir.values()) {
      const path = prefix ? `${prefix}/${child.name}` : child.name;
      if (child.kind === "directory") {
        if (!SKIP_DIRS.has(child.name)) await walk(child as DirectoryHandle, path, depth + 1);
      } else if (entries.length < MAX_ENTRIES) {
        const fileHandle = child as FileSystemFileHandle;
        entries.push({ path, size: null, getFile: () => fileHandle.getFile() });
      }
    }
  }

  await walk(handle as DirectoryHandle, "", 0);
  return { root: handle.name, entries };
}

// Fra <input type="file" webkitdirectory> (reserve for Safari/Firefox).
export function entriesFromFileList(files: FileList): { root: string; entries: FolderEntry[] } {
  const all = [...files];
  const root = all[0]?.webkitRelativePath.split("/")[0] ?? "prosjekt";
  const entries = all
    .map((file) => ({ file, path: file.webkitRelativePath.split("/").slice(1).join("/") }))
    .filter(({ path }) => path && !isSkipped(path) && path.split("/").length <= MAX_DEPTH + 1)
    .slice(0, MAX_ENTRIES)
    .map(({ file, path }) => ({ path, size: file.size, getFile: async () => file }));
  return { root, entries };
}

/* -------------------------------------------------------------------------- */
/*  Teknologier                                                               */
/* -------------------------------------------------------------------------- */

const NPM_TECH: Record<string, string> = {
  react: "React",
  next: "Next.js",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  "@sveltejs/kit": "SvelteKit",
  "@angular/core": "Angular",
  "solid-js": "Solid",
  astro: "Astro",
  "react-native": "React Native",
  expo: "Expo",
  electron: "Electron",
  tailwindcss: "Tailwind CSS",
  "styled-components": "styled-components",
  sass: "Sass",
  express: "Express",
  fastify: "Fastify",
  "@nestjs/core": "NestJS",
  hono: "Hono",
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  "drizzle-orm": "Drizzle",
  mongoose: "MongoDB",
  mongodb: "MongoDB",
  pg: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql2: "MySQL",
  redis: "Redis",
  "@supabase/supabase-js": "Supabase",
  firebase: "Firebase",
  graphql: "GraphQL",
  "socket.io": "Socket.IO",
  three: "Three.js",
  "@react-three/fiber": "Three.js",
  d3: "D3",
  "framer-motion": "Framer Motion",
  gsap: "GSAP",
  vite: "Vite",
  typescript: "TypeScript",
  stripe: "Stripe",
  "@tensorflow/tfjs": "TensorFlow",
  ogl: "WebGL",
};

const PY_TECH: Record<string, string> = {
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  torch: "PyTorch",
  tensorflow: "TensorFlow",
  pandas: "pandas",
  numpy: "NumPy",
  "scikit-learn": "scikit-learn",
  streamlit: "Streamlit",
};

const EXT_LANG: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  py: "Python",
  kt: "Kotlin",
  java: "Java",
  swift: "Swift",
  go: "Go",
  rs: "Rust",
  cs: "C#",
  cpp: "C++",
  cc: "C++",
  c: "C",
  dart: "Dart",
  rb: "Ruby",
  php: "PHP",
  vue: "Vue",
  svelte: "Svelte",
  html: "HTML",
  css: "CSS",
  scss: "Sass",
  ipynb: "Jupyter",
};

function githubUrl(repository: unknown): string {
  const raw = typeof repository === "string" ? repository : (repository as { url?: string } | null)?.url;
  if (!raw) return "";
  const shorthand = /^(?:github:)?([\w.-]+)\/([\w.-]+)$/.exec(raw);
  if (shorthand) return `https://github.com/${shorthand[1]}/${shorthand[2]}`;
  const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(raw);
  return match ? `https://github.com/${match[1]}/${match[2]}` : "";
}

/* -------------------------------------------------------------------------- */
/*  README                                                                    */
/* -------------------------------------------------------------------------- */

const MD_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_IMG = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

const isRemote = (src: string) => /^(https?:)?\/\//i.test(src) || src.startsWith("data:");

// Løser "./docs/bilde.png" relativt til mappen README-en ligger i.
export function resolveRelative(dir: string, src: string) {
  const clean = decodeURIComponent(src.split(/[?#]/)[0]);
  const parts = (clean.startsWith("/") ? clean.slice(1) : `${dir}${clean}`).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function readmeImagePaths(markdown: string, dir: string) {
  const paths: string[] = [];
  for (const m of markdown.matchAll(MD_IMAGE)) if (!isRemote(m[2])) paths.push(resolveRelative(dir, m[2]));
  for (const m of markdown.matchAll(HTML_IMG)) if (!isRemote(m[1])) paths.push(resolveRelative(dir, m[1]));
  return paths;
}

// Bytter lokale bildestier i README-en med URL-ene bildene fikk etter opplasting.
// Lokale bilder som ikke ble lastet opp, fjernes så de ikke vises som ødelagte.
export function rewriteReadmeImages(markdown: string, dir: string, uploaded: Map<string, string>) {
  return markdown
    .replace(MD_IMAGE, (all, alt, src) => {
      if (isRemote(src)) return all;
      const url = uploaded.get(resolveRelative(dir, src));
      return url ? `![${alt}](${url})` : "";
    })
    .replace(HTML_IMG, (all, src) => {
      if (isRemote(src)) return all;
      const url = uploaded.get(resolveRelative(dir, src));
      return url ? all.replace(src, url) : "";
    });
}

function plainFirstParagraph(markdown: string) {
  const blocks = markdown
    .replace(/<[^>]+>/g, " ")
    .replace(MD_IMAGE, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !b.startsWith("#") && !b.startsWith("```") && !b.startsWith("|") && !/^[-*]\s/.test(b));
  const text = (blocks[0] ?? "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 200 ? `${text.slice(0, 197).replace(/\s+\S*$/, "")}…` : text;
}

export function prettifyName(name: string) {
  return name
    .replace(/^@[\w.-]+\//, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => (w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/*  Analyse                                                                   */
/* -------------------------------------------------------------------------- */

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const NOT_SCREENSHOT = /(icon|logo|favicon|badge|sprite|avatar|apple-touch|android-chrome|mstile|emoji|placeholder)/i;

function screenshotScore(path: string, size: number) {
  if (NOT_SCREENSHOT.test(path) || size < 25_000) return 0;
  // Store bilder som ikke er ikoner er som regel skjermbilder eller illustrasjoner.
  let score = size > 80_000 ? 1 : 0;
  if (/(^|\/)(screenshots?|screens|previews?|docs|media|images?|img|assets|showcase|bilder|skjermbilder|skjermdumper)\//i.test(path)) score += 2;
  if (/(screenshot|screen|preview|demo|mockup|cover|hero|banner|showcase|skjermbilde|skjermdump|forside)/i.test(path.split("/").pop()!)) score += 3;
  return score;
}

// Rammeverk og plattformer først, så språk, så biblioteker.
const TAG_PRIORITY = [
  "Next.js", "React", "React Native", "Vue", "Nuxt", "Svelte", "SvelteKit", "Angular", "Astro", "Solid",
  "Flutter", "Android", "Jetpack Compose", "Swift", "Expo", "Electron", "Django", "Flask", "FastAPI",
  "Express", "NestJS", "TypeScript", "JavaScript", "Python", "Kotlin", "Java", "Go", "Rust", "C#", "C++", "Dart",
];
const priority = (tag: string) => {
  const i = TAG_PRIORITY.indexOf(tag);
  return i === -1 ? TAG_PRIORITY.length : i;
};

const depth = (path: string) => path.split("/").length;

export async function analyzeFolder(root: string, entries: FolderEntry[]): Promise<FolderDraft> {
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const basename = (p: string) => p.split("/").pop()!.toLowerCase();
  const shallowest = (test: (name: string) => boolean) =>
    entries.filter((e) => test(basename(e.path))).sort((a, b) => depth(a.path) - depth(b.path))[0];
  const readText = async (e?: FolderEntry) => (e ? (await e.getFile()).text() : "");

  // README
  const readmeEntry = shallowest((n) => /^readme(\.(md|markdown|txt))?$/.test(n));
  const readme = (await readText(readmeEntry)).replace(/\r\n/g, "\n");
  const readmeDir = readmeEntry?.path.includes("/") ? readmeEntry.path.slice(0, readmeEntry.path.lastIndexOf("/") + 1) : "";
  const h1 = /^\s*#\s+(.+?)\s*#*\s*$/m.exec(readme.split("\n").find((l) => l.trim()) ?? "");

  // Manifester
  const tags: string[] = [];
  let pkg: { name?: string; description?: string; homepage?: string; repository?: unknown; dependencies?: object; devDependencies?: object } = {};
  try {
    pkg = JSON.parse((await readText(shallowest((n) => n === "package.json"))) || "{}");
  } catch {}
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) if (NPM_TECH[dep]) tags.push(NPM_TECH[dep]);

  const names = new Set(entries.map((e) => basename(e.path)));
  const pyManifest = shallowest((n) => n === "requirements.txt" || n === "pyproject.toml");
  if (pyManifest) {
    tags.push("Python");
    const text = (await readText(pyManifest)).toLowerCase();
    for (const [dep, name] of Object.entries(PY_TECH)) if (new RegExp(`(^|[^\\w-])${dep}([^\\w-]|$)`, "m").test(text)) tags.push(name);
  }
  const gradle = shallowest((n) => n === "build.gradle" || n === "build.gradle.kts");
  if (gradle) {
    const text = await readText(gradle);
    if (/com\.android/.test(text)) tags.push("Android");
    if (/compose/i.test(text)) tags.push("Jetpack Compose");
  }
  if (names.has("pubspec.yaml")) tags.push("Flutter", "Dart");
  if (names.has("cargo.toml")) tags.push("Rust");
  if (names.has("go.mod")) tags.push("Go");
  if (names.has("pom.xml")) tags.push("Java");
  if (names.has("package.swift") || entries.some((e) => e.path.includes(".xcodeproj/"))) tags.push("Swift");
  if (names.has("dockerfile") || names.has("docker-compose.yml")) tags.push("Docker");
  if ([...names].some((n) => n.endsWith(".csproj"))) tags.push("C#", ".NET");

  // Språk ut fra filendelser
  const counts = new Map<string, number>();
  for (const e of entries) {
    const lang = EXT_LANG[basename(e.path).split(".").pop() ?? ""];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  // Små prosjekter (f.eks. en nettside med tre filer) teller hver fil; større trenger flere.
  const minCount = entries.length < 60 ? 1 : 3;
  for (const [lang, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    if (count < minCount) continue;
    if ((lang === "HTML" || lang === "CSS") && tags.length >= 3) continue;
    tags.push(lang);
  }

  // Bilder: først de README-en viser, så filer som ser ut som skjermbilder.
  const images: FolderImage[] = [];
  const seen = new Set<string>();
  for (const path of readmeImagePaths(readme, readmeDir)) {
    const entry = byPath.get(path);
    if (!entry || seen.has(path) || !IMAGE_EXT.test(path) || NOT_SCREENSHOT.test(path)) continue;
    seen.add(path);
    images.push({ path, file: await entry.getFile(), fromReadme: true });
  }
  const candidates = await Promise.all(
    entries
      .filter((e) => IMAGE_EXT.test(e.path) && !seen.has(e.path) && !/(^|\/)public\/.*(icon|logo)/i.test(e.path))
      .slice(0, 400)
      .map(async (e) => {
        const file = await e.getFile();
        return { path: e.path, file, score: screenshotScore(e.path, file.size) };
      }),
  );
  const ranked = candidates.filter((c) => c.score >= 2).sort((a, b) => b.score - a.score || b.file.size - a.file.size);
  // Fant vi få tydelige skjermbilder, tar vi med store bilder også.
  if (ranked.length < 3) ranked.push(...candidates.filter((c) => c.score === 1).sort((a, b) => b.file.size - a.file.size));
  for (const c of ranked) {
    if (images.length >= MAX_FOLDER_IMAGES) break;
    images.push({ path: c.path, file: c.file, fromReadme: false });
  }

  const titleFromReadme = h1 && h1[1].length <= 60 ? h1[1].replace(/[*_`]/g, "").trim() : "";
  const description = h1 ? readme.replace(h1[0], "").trimStart() : readme;

  return {
    title: (titleFromReadme || prettifyName(pkg.name || root)).slice(0, 100),
    summary: (pkg.description?.trim() || plainFirstParagraph(description)).slice(0, 200),
    description: description.slice(0, 20_000),
    readmeDir,
    tags: [...new Set(tags)].sort((a, b) => priority(a) - priority(b)).slice(0, 15),
    repoUrl: githubUrl(pkg.repository),
    demoUrl: pkg.homepage && /^https?:\/\//.test(pkg.homepage) ? pkg.homepage : "",
    images: images.slice(0, MAX_FOLDER_IMAGES),
    fileCount: entries.length,
  };
}

// Store skjermbilder (retina-PNG-er) skaleres ned så de holder seg under 4 MB.
export async function prepareImage(file: File, maxWidth = 2400): Promise<File> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  if (file.size < 3.5 * 1024 * 1024 && bitmap.width <= maxWidth) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
  const out = blob?.type === "image/webp" ? blob : await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  if (!out) return file;
  return new File([out], file.name.replace(/\.\w+$/, out.type === "image/webp" ? ".webp" : ".jpg"), { type: out.type });
}
