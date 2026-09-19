import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import mammoth from "mammoth";
import { UserFacingError } from "@/lib/result";
import { parsedCv, type ParsedCv } from "@/lib/validation";

export const MAX_CV_BYTES = 4 * 1024 * 1024;

const MODEL = "claude-opus-5";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SYSTEM_PROMPT = `Du leser CV-er for Vis, en norsk portefølje-plattform for utviklere og designere.
Hent ut innholdet i CV-en til de strukturerte feltene.

- Ta bare med det som faktisk står i CV-en. Ikke finn på eller gjett innhold; bruk null eller tomme lister når noe mangler.
- Behold språket CV-en er skrevet på (ikke oversett).
- Datoer skrives som "ÅÅÅÅ-MM" når måneden er oppgitt, ellers "ÅÅÅÅ". Pågående stillinger/studier ("nå", "d.d.", "present") får endDate null.
- experience: jobber, deltidsjobber, frivillig arbeid og verv. title er rollen, organization er arbeidsgiveren.
- education: grader, studier og relevante kurs med institusjon.
- description: kort sammendrag av punktene i CV-en, én linje per punkt, uten punkttegn.
- skills: konkrete ferdigheter (språk, rammeverk, verktøy, metoder), hver bare én gang, maks 40.
- links: bare lenker som står i CV-en (LinkedIn, GitHub, nettside, portefølje). label er f.eks. "LinkedIn".
- headline: én kort linje om hvem personen er faglig, f.eks. "Frontend-utvikler" eller "Informatikkstudent ved UiO", hvis det går tydelig frem.
- summary: personens egen profiltekst/sammendrag hvis CV-en har en, ellers null.
- Rekkefølge: nyeste først, slik de står i CV-en.
- Hvis dokumentet ikke er en CV, returner tomme lister og null-felter.`;

export type CvFile = { name: string; type: string; bytes: Uint8Array };

// Word-filer sendes noen ganger med generisk MIME-type, så filendelsen brukes som reserve.
export function detectCvType(file: { name: string; type: string }, bytes: Uint8Array) {
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  if (isPdf) return PDF;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // .docx er en zip-fil
  if (isZip && (file.type === DOCX || file.name.toLowerCase().endsWith(".docx"))) return DOCX;
  return null;
}

async function toContent(file: CvFile, type: string): Promise<Anthropic.Beta.BetaContentBlockParam> {
  if (type === PDF) {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: Buffer.from(file.bytes).toString("base64") },
    };
  }

  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) });
  const text = value.trim();
  if (!text) throw new UserFacingError("Fant ingen tekst i dokumentet.");
  return { type: "text", text: `<cv>\n${text}\n</cv>` };
}

const YEAR_MONTH = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

// Rydder opp i svaret: ugyldige datoer blir null, tomme oppføringer og duplikater fjernes.
function clean(cv: ParsedCv): ParsedCv {
  const date = (v: string | null) => (v && YEAR_MONTH.test(v.trim()) ? v.trim() : null);
  const text = (v: string | null) => v?.trim() || null;
  const seenSkills = new Set<string>();

  return {
    name: text(cv.name),
    headline: text(cv.headline)?.slice(0, 120) ?? null,
    summary: text(cv.summary)?.slice(0, 2000) ?? null,
    location: text(cv.location)?.slice(0, 100) ?? null,
    links: cv.links
      .map((l) => ({ label: l.label.trim().slice(0, 40), url: l.url.trim() }))
      .map((l) => ({ ...l, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` }))
      .filter((l) => l.label && URL.canParse(l.url))
      .slice(0, 10),
    experience: cv.experience
      .filter((e) => e.title.trim() && e.organization.trim())
      .map((e) => ({
        title: e.title.trim(),
        organization: e.organization.trim(),
        location: text(e.location),
        startDate: date(e.startDate),
        endDate: date(e.endDate),
        description: text(e.description),
      })),
    education: cv.education
      .filter((e) => e.institution.trim())
      .map((e) => ({
        institution: e.institution.trim(),
        degree: text(e.degree),
        fieldOfStudy: text(e.fieldOfStudy),
        startDate: date(e.startDate),
        endDate: date(e.endDate),
        description: text(e.description),
      })),
    skills: cv.skills
      .map((s) => s.trim())
      .filter((s) => {
        const key = s.toLowerCase();
        if (!s || s.length > 60 || seenSkills.has(key)) return false;
        seenSkills.add(key);
        return true;
      })
      .slice(0, 40),
  };
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

async function requestParse(file: CvFile, type: string) {
  const document = await toContent(file, type);
  try {
    return await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Går videre til en reservemodell hvis forespørselen avvises.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(parsedCv) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [document, { type: "text", text: "Hent ut innholdet i denne CV-en." }],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500)) {
      throw new UserFacingError("CV-lesingen er travel akkurat nå. Prøv igjen om litt.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new UserFacingError("Fikk ikke kontakt med tjenesten som leser CV-en. Prøv igjen.");
    }
    if (error instanceof Anthropic.AuthenticationError || !(error instanceof Anthropic.APIError)) {
      // Mangler eller ugyldig API-nøkkel (ANTHROPIC_API_KEY).
      console.error("[cv-parser]", error);
      throw new UserFacingError("CV-import er ikke satt opp ennå.");
    }
    throw error;
  }
}

export async function parseCv(file: CvFile): Promise<ParsedCv> {
  if (file.bytes.byteLength === 0) throw new UserFacingError("Filen er tom.");
  if (file.bytes.byteLength > MAX_CV_BYTES) throw new UserFacingError("CV-en er for stor (maks 4 MB).");

  const type = detectCvType(file, file.bytes);
  if (!type) throw new UserFacingError("Last opp CV-en som PDF eller Word (.docx).");

  const response = await requestParse(file, type);

  if (response.stop_reason === "refusal") {
    throw new UserFacingError("Klarte ikke å lese denne CV-en. Prøv en annen fil.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new UserFacingError("CV-en er for lang til å importeres automatisk.");
  }
  if (!response.parsed_output) {
    throw new Error(`CV-tolkingen ga ikke gyldig JSON (stop_reason: ${response.stop_reason})`);
  }

  return clean(response.parsed_output);
}
