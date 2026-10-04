import "server-only";

import mammoth from "mammoth";
import { UserFacingError } from "@/lib/result";
import type { CvLine } from "@/lib/cv-text-parser";

// Henter teksten ut av en CV som linjer, med skriftstørrelse og innrykk, så tolkeren
// (lib/cv-text-parser.ts) kan se hva som er overskrifter og kulepunkter. Alt skjer
// lokalt på serveren; filen sendes ikke videre til noen tjeneste.

const MAX_PAGES = 6;
const TIMEOUT_MS = 15_000;

type Item = { str: string; x: number; y: number; w: number; h: number };

/* -------------------------------------------------------------------------- */
/*  PDF                                                                       */
/* -------------------------------------------------------------------------- */

// To spalter (sidespalte + hovedspalte) leses hver for seg. Vi ser etter en loddrett
// stripe uten tekst midt på siden. Står tekst på begge sider ofte på samme linje,
// er det en tabell (rolle til venstre, dato til høyre) og ikke spalter.
type Column = { column: number; items: Item[] };

function splitColumns(items: Item[], width: number): Column[] {
  const single = [{ column: 0, items }];
  if (items.length < 12 || width <= 0) return single;
  const size = Math.ceil(width) + 1;
  const crossing = new Uint16Array(size);
  for (const it of items) {
    for (let x = Math.max(0, Math.floor(it.x)); x < Math.min(size, Math.ceil(it.x + it.w)); x++) crossing[x]++;
  }

  // Noen få elementer (f.eks. navnet i et banner over begge spaltene) får krysse stripen.
  const allowed = Math.max(2, Math.floor(items.length * 0.03));
  let best: { start: number; end: number } | null = null;
  let runStart = -1;
  let seenText = false;
  for (let x = 0; x < size; x++) {
    const open = crossing[x] <= allowed;
    if (!open) {
      if (runStart >= 0 && seenText && (!best || x - runStart > best.end - best.start)) best = { start: runStart, end: x };
      runStart = -1;
      seenText = true;
    } else if (runStart < 0) {
      runStart = x;
    }
  }
  if (!best || best.end - best.start < 10) return single;
  const cut = (best.start + best.end) / 2;
  if (cut < width * 0.15 || cut > width * 0.85) return single;

  const spanning = items.filter((it) => it.x < cut - 2 && it.x + it.w > cut + 2);
  const rest = items.filter((it) => !spanning.includes(it));
  const left = rest.filter((it) => it.x + it.w / 2 < cut);
  const right = rest.filter((it) => it.x + it.w / 2 >= cut);

  const chars = (list: Item[]) => list.reduce((n, it) => n + it.str.length, 0);
  const total = chars(items);
  if (chars(left) < total * 0.08 || chars(right) < total * 0.08) return single;

  const rows = (list: Item[]) => new Set(list.map((it) => Math.round(it.y)));
  const leftRows = rows(left);
  const rightRows = rows(right);
  let shared = 0;
  for (const y of rightRows) if (leftRows.has(y) || leftRows.has(y - 1) || leftRows.has(y + 1)) shared++;
  if (shared / Math.min(leftRows.size, rightRows.size) > 0.5) return single;

  // Det som krysser stripen øverst (banner) leses først; resten går til spalten det står mest i.
  const top = Math.max(...rest.map((it) => it.y));
  const header = spanning.filter((it) => it.y >= top - 2);
  for (const it of spanning) {
    if (header.includes(it)) continue;
    (it.x + it.w / 2 < cut ? left : right).push(it);
  }
  return [
    { column: -1, items: header },
    { column: 0, items: left },
    { column: 1, items: right },
  ].filter((c) => c.items.length > 0);
}

function toLines(items: Item[]): CvLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Item[][] = [];
  for (const it of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].y - it.y) <= Math.max(2, Math.min(row[0].h, it.h) * 0.5)) row.push(it);
    else rows.push([it]);
  }

  // Venstremargen er det vanligste startpunktet for en linje; linjer lenger inn er kulepunkter.
  const starts = new Map<number, number>();
  for (const row of rows) {
    const x = Math.round(Math.min(...row.map((it) => it.x)));
    starts.set(x, (starts.get(x) ?? 0) + 1);
  }
  const margin = [...starts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let text = "";
    let end = -Infinity;
    for (const it of row) {
      const gap = it.x - end;
      const h = Math.max(it.h, 1);
      if (text && gap > h * 1.5) text += "\t";
      else if (text && gap > h * 0.12 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += " ";
      text += it.str;
      end = Math.max(end, it.x + it.w);
    }
    const indent = Math.min(...row.map((it) => it.x)) - margin;
    return { text, size: Math.round(Math.max(...row.map((it) => it.h)) * 10) / 10, indent: indent > 4 && indent < 80 };
  });
}

function withTimeout<T>(promise: Promise<T>, onTimeout: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new UserFacingError("Det tok for lang tid å lese PDF-en. Prøv en enklere fil."));
    }, TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function pdfToLines(bytes: Uint8Array): Promise<CvLine[]> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ]);
  // Uten egen worker-tråd kjører pdf.js «workeren» i samme prosess. Når modulen ligger
  // klar på globalThis, slipper pdf.js å laste den selv (det virker ikke etter bundling).
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker ??= worker;
  const task = pdfjs.getDocument({
    // pdf.js tar over bufferen, så den får en kopi.
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  const read = async () => {
    const doc = await task.promise;
    const lines: CvLine[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const { width } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const [a, b, c, d, x, y] = it.transform as number[];
        if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) continue; // rotert pyntetekst
        items.push({ str: it.str, x, y, w: it.width, h: it.height || Math.abs(d) || Math.abs(a) });
      }
      for (const { column, items: columnItems } of splitColumns(items, width)) {
        lines.push(...toLines(columnItems).map((line) => ({ ...line, page: n, column })));
      }
      page.cleanup();
    }
    return lines;
  };

  try {
    return await withTimeout(read(), () => void task.destroy());
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") throw new UserFacingError("PDF-en er passordbeskyttet. Lagre den uten passord og prøv igjen.");
    if (name === "InvalidPDFException") throw new UserFacingError("Klarte ikke å åpne PDF-en. Er filen skadet?");
    throw error;
  } finally {
    void task.destroy();
  }
}

/* -------------------------------------------------------------------------- */
/*  Word (.docx)                                                              */
/* -------------------------------------------------------------------------- */

const SIZES: Record<string, number> = { h1: 24, h2: 16, h3: 14, h4: 13, h5: 12, h6: 12 };
const BLOCKS = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th"]);

function decode(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Word-dokumentet gjøres om til enkel HTML, så overskrifter og kulepunkter kan skilles fra brødtekst.
export async function docxToLines(bytes: Uint8Array): Promise<CvLine[]> {
  let html: string;
  try {
    ({ value: html } = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      // Bilder trengs ikke og ville bare gjort HTML-en stor.
      { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
    ));
  } catch {
    throw new UserFacingError("Klarte ikke å åpne Word-filen. Er den skadet?");
  }

  const lines: CvLine[] = [];
  let current: { tag: string; text: string } | null = null;
  const flush = () => {
    if (!current) return;
    const text = decode(current.text).trim();
    if (text) lines.push({ text, size: SIZES[current.tag] ?? 11, indent: current.tag === "li" });
    current = null;
  };

  for (const part of html.split(/(<[^>]+>)/)) {
    const tag = /^<(\/?)([a-z0-9]+)/i.exec(part);
    if (tag) {
      const name = tag[2].toLowerCase();
      if (BLOCKS.has(name)) {
        flush();
        if (!tag[1]) current = { tag: name, text: "" };
      } else if (name === "br" && current) {
        current.text += "\n";
      }
      continue;
    }
    if (current) current.text += part;
    else if (part.trim()) lines.push({ text: decode(part).trim(), size: 11 });
  }
  flush();
  return lines;
}
