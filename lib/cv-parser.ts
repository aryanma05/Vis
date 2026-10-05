import "server-only";

import { docxToLines, pdfToLines } from "@/lib/cv-extract";
import { parseCvLines } from "@/lib/cv-text-parser";
import { isPdf, sniffImageType } from "@/lib/file-signatures";
import { UserFacingError } from "@/lib/result";
import type { ParsedCv } from "@/lib/validation";

// CV-er leses helt lokalt: teksten hentes ut av PDF-en eller Word-filen her på serveren
// og tolkes med faste regler (lib/cv-text-parser.ts). Ingen eksterne tjenester, ingen
// kostnad per import.

export const MAX_CV_BYTES = 4 * 1024 * 1024;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type CvFile = { name: string; type: string; bytes: Uint8Array };

// PDF, Word eller bilde av CV-en. Word-filer sendes noen ganger med generisk
// MIME-type, så filendelsen brukes som reserve.
export function detectCvType(file: { name: string; type: string }, bytes: Uint8Array) {
  if (isPdf(bytes)) return PDF;
  const image = sniffImageType(bytes);
  if (image) return image;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // .docx er en zip-fil
  if (isZip && (file.type === DOCX || file.name.toLowerCase().endsWith(".docx"))) return DOCX;
  return null;
}

const isEmpty = (cv: ParsedCv) =>
  !cv.headline && !cv.summary && cv.experience.length + cv.education.length + cv.skills.length + cv.links.length === 0;

export async function parseCv(file: CvFile): Promise<ParsedCv> {
  if (file.bytes.byteLength === 0) throw new UserFacingError("Filen er tom.");
  if (file.bytes.byteLength > MAX_CV_BYTES) throw new UserFacingError("CV-en er for stor (maks 4 MB).");

  const type = detectCvType(file, file.bytes);
  if (type?.startsWith("image/")) {
    throw new UserFacingError("Feltene kan bare fylles ut fra PDF eller Word. Last opp CV-en som PDF, eller fyll ut feltene selv.");
  }
  if (!type) throw new UserFacingError("Last opp CV-en som PDF eller Word (.docx).");

  const lines = type === PDF ? await pdfToLines(file.bytes) : await docxToLines(file.bytes);
  const letters = lines.reduce((n, l) => n + l.text.replace(/[^\p{L}]/gu, "").length, 0);
  if (letters < 40) {
    throw new UserFacingError(
      type === PDF
        ? "Fant ingen tekst i PDF-en. Er den skannet som bilde? Eksporter den på nytt fra Word, Google Docs eller LinkedIn."
        : "Fant ingen tekst i dokumentet.",
    );
  }

  const cv = parseCvLines(lines);
  if (isEmpty(cv)) throw new UserFacingError("Fant ikke noe vi kunne fylle ut fra denne CV-en. Fyll ut feltene selv, eller prøv en annen fil.");
  return cv;
}
