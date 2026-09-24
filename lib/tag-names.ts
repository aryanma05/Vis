// Navn og nøkler for teknologier. Ren logikk uten database, så den kan brukes i nettleseren også.

export const MAX_TAGS_PER_PROJECT = 15;

// Riktig skrivemåte for vanlige teknologier, slik at "nextjs" fra GitHub og
// "Next.js" skrevet for hånd blir samme tag og ser pen ut.
const KNOWN_NAMES: Record<string, string> = {
  android: "Android",
  angular: "Angular",
  aws: "AWS",
  azure: "Azure",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  dart: "Dart",
  django: "Django",
  docker: "Docker",
  dotnet: ".NET",
  expo: "Expo",
  express: "Express",
  fastapi: "FastAPI",
  figma: "Figma",
  firebase: "Firebase",
  flutter: "Flutter",
  go: "Go",
  golang: "Go",
  graphql: "GraphQL",
  html: "HTML",
  ios: "iOS",
  java: "Java",
  javascript: "JavaScript",
  js: "JavaScript",
  kotlin: "Kotlin",
  kubernetes: "Kubernetes",
  laravel: "Laravel",
  mongodb: "MongoDB",
  mysql: "MySQL",
  nestjs: "NestJS",
  nextjs: "Next.js",
  nodejs: "Node.js",
  php: "PHP",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  prisma: "Prisma",
  python: "Python",
  pytorch: "PyTorch",
  react: "React",
  reactjs: "React",
  "react-native": "React Native",
  redis: "Redis",
  ruby: "Ruby",
  rails: "Ruby on Rails",
  rust: "Rust",
  sass: "Sass",
  scss: "SCSS",
  sql: "SQL",
  sqlite: "SQLite",
  supabase: "Supabase",
  svelte: "Svelte",
  swift: "Swift",
  swiftui: "SwiftUI",
  tailwindcss: "Tailwind CSS",
  tensorflow: "TensorFlow",
  threejs: "Three.js",
  typescript: "TypeScript",
  ts: "TypeScript",
  unity: "Unity",
  vercel: "Vercel",
  vue: "Vue",
  vuejs: "Vue",
};

// "Next.js" -> "nextjs", "C#" -> "csharp", "React Native" -> "react-native".
export function tagSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\+\+/g, "pp")
    .replace(/#/g, "sharp")
    .replace(/^\./, "dot")
    .replace(/\./g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Fjerner duplikater (etter slug) og tomme tagger, beholder rekkefølgen.
export function normalizeTagNames(names: string[]): { slug: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    const slug = tagSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.set(slug, KNOWN_NAMES[slug] ?? name);
  }
  return [...seen.entries()]
    .slice(0, MAX_TAGS_PER_PROJECT)
    .map(([slug, name]) => ({ slug, name }));
}
