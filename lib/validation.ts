import { z } from "zod";
import { MAX_TAGS_PER_PROJECT } from "@/lib/tags";

const emptyToNull = (v: string | null | undefined) => (v ? v : null);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maks ${max} tegn.`)
    .nullish()
    .transform(emptyToNull);

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform(emptyToNull)
  .refine(
    (v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v),
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

export const projectInput = z.object({
  title: z.string().trim().min(1, "Prosjektet må ha en tittel.").max(100, "Maks 100 tegn."),
  summary: optionalText(200),
  description: z.string().max(20_000, "Beskrivelsen er for lang.").nullish().transform((v) => v ?? ""),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  projectDate: yearMonth,
  tags: tagList,
  status: z.enum(["draft", "published"]).default("published"),
});

export type ProjectInput = z.output<typeof projectInput>;

export const socialLink = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(500),
});

export const profileInput = z.object({
  name: z.string().trim().min(1, "Navn kan ikke være tomt.").max(100),
  headline: optionalText(120),
  bio: optionalText(2000),
  location: optionalText(100),
  websiteUrl: optionalUrl,
  links: z.array(socialLink).max(10).default([]),
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
