import { z } from "zod";
import { ACCENT_KEYS, MAX_PROJECT_MEMBERS, OPEN_TO, PROJECT_PROGRESS } from "@/lib/constants";
import {
  BANNER_ART_KEYS,
  BANNER_GRADIENT_KEYS,
  BANNER_PATTERN_KEYS,
  PET_ACCESSORY_KEYS,
  PET_COLOR_KEYS,
  PET_NAME_MAX,
  PET_SPECIES_KEYS,
} from "@/lib/profile-style";
import { MAX_TAGS_PER_PROJECT } from "@/lib/tag-names";

const emptyToNull = (v: string | null | undefined) => (v ? v : null);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maks ${max} tegn.`)
    .nullish()
    .transform(emptyToNull);

// Under utvikling godtas også lenker til egen maskin («localhost:5173»), så man kan
// teste prosjekter som kjører lokalt. I produksjon gir de ingen mening for andre.
const allowLocalLinks = process.env.NODE_ENV !== "production";
const LOCAL_LINK = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/i;

// Godtar "vis.no" og legger til https:// selv, siden folk sjelden skriver det.
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform(emptyToNull)
  .transform((v) => {
    if (!v || /^https?:\/\//i.test(v)) return v;
    if (allowLocalLinks && LOCAL_LINK.test(v)) return `http://${v}`;
    return /^[\w-]+(\.[\w-]+)+/.test(v) ? `https://${v}` : v;
  })
  .refine(
    (v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v) || (allowLocalLinks && LOCAL_LINK.test(v)),
    "Lenken må starte med http:// eller https://",
  );

// "2024-05" eller "2024".
export const yearMonth = z
  .string()
  .trim()
  .nullish()
  .transform(emptyToNull)
  .refine(
    (v) => v === null || /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(v),
    "Bruk formatet ÅÅÅÅ-MM eller ÅÅÅÅ.",
  );

// Tagger kan komme som liste eller som kommaseparert tekst fra et skjema.
const tagList = z
  .union([z.array(z.string()), z.string()])
  .nullish()
  .transform((v) =>
    (typeof v === "string" ? v.split(",") : (v ?? []))
      .map((t) => t.trim())
      .filter(Boolean),
  )
  .refine((v) => v.length <= MAX_TAGS_PER_PROJECT, `Maks ${MAX_TAGS_PER_PROJECT} teknologier.`)
  .refine((v) => v.every((t) => t.length <= 40), "En teknologi kan ha maks 40 tegn.");

// Medlemmer som kommaseparerte brukernavn. Mangler feltet, røres ikke medlemmene
// (f.eks. ved import), mens et tomt felt fjerner alle.
const memberList = z
  .string()
  .max(2_000)
  .nullish()
  .transform((v) => (v == null ? undefined : [...new Set(v.split(",").map((u) => u.trim().toLowerCase()).filter(Boolean))]))
  .refine((v) => !v || v.length <= MAX_PROJECT_MEMBERS, `Maks ${MAX_PROJECT_MEMBERS} medlemmer.`);

export const projectInput = z.object({
  title: z.string().trim().min(1, "Prosjektet må ha en tittel.").max(100, "Maks 100 tegn."),
  summary: optionalText(200),
  description: z.string().max(20_000, "Beskrivelsen er for lang.").nullish().transform((v) => v ?? ""),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  videoUrl: optionalUrl,
  role: optionalText(80),
  projectDate: yearMonth,
  tags: tagList,
  status: z.enum(["draft", "published"]).default("published"),
  // Mangler den, beholdes det som er lagret (nye prosjekter blir «fullført»).
  progress: z
    .enum(PROJECT_PROGRESS)
    .nullish()
    .transform((v) => v ?? undefined),
  members: memberList,
});

export type ProjectInput = z.output<typeof projectInput>;

export const socialLink = z.object({
  label: z.string().trim().min(1).max(40),
  url: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url()),
});

const customSection = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1, "Seksjonen må ha en tittel.").max(60),
  body: z.string().trim().max(5000),
});

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Ugyldig farge.").transform((v) => v.toLowerCase());

// Bildet må være lastet opp her (sjekkes mot fillagringen i lib/profiles.ts).
export const bannerConfig = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accent") }),
  z.object({ type: z.literal("color"), color: hexColor }),
  z.object({ type: z.literal("gradient"), gradient: z.enum(BANNER_GRADIENT_KEYS) }),
  z.object({ type: z.literal("pattern"), pattern: z.enum(BANNER_PATTERN_KEYS), color: hexColor }),
  z.object({ type: z.literal("art"), art: z.enum(BANNER_ART_KEYS) }),
  z.object({ type: z.literal("image"), url: z.string().max(500), y: z.number().min(0).max(100).transform(Math.round) }),
]);

export const petConfig = z.object({
  species: z.enum(PET_SPECIES_KEYS),
  color: z.enum(PET_COLOR_KEYS),
  accessory: z.enum(PET_ACCESSORY_KEYS).default("ingen"),
  name: z.string().trim().max(PET_NAME_MAX, `Navnet kan ha maks ${PET_NAME_MAX} tegn.`).default(""),
});

export const profileInput = z.object({
  name: z.string().trim().min(1, "Navn kan ikke være tomt.").max(100),
  headline: optionalText(120),
  bio: optionalText(2000),
  location: optionalText(100),
  websiteUrl: optionalUrl,
  links: z.array(socialLink).max(10).default([]),
  readme: optionalText(10_000),
  lookingFor: optionalText(400),
  openTo: z.array(z.enum(OPEN_TO)).max(OPEN_TO.length).default([]),
  customSections: z.array(customSection).max(8).default([]),
  accentColor: z.enum(ACCENT_KEYS).nullish().transform((v) => v ?? null),
  contactEnabled: z.boolean().default(false),
  // Mangler feltet, røres ikke det som er lagret. null fjerner banneret / kjæledyret.
  banner: bannerConfig.nullish(),
  pet: petConfig.nullish(),
});

export type ProfileInput = z.output<typeof profileInput>;

// Formatet språkmodellen skal returnere, og som brukeren kan redigere før det lagres.
export const parsedCv = z.object({
  name: z.string().nullable(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  experience: z.array(
    z.object({
      title: z.string(),
      organization: z.string(),
      location: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      description: z.string().nullable(),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().nullable(),
      fieldOfStudy: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      description: z.string().nullable(),
    }),
  ),
  skills: z.array(z.string()),
});

export type ParsedCv = z.infer<typeof parsedCv>;

// Gjør zod-feil om til { felt: [meldinger] } for skjemaer.
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
