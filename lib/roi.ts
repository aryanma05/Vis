import type { RoiSettings } from "@/db/schema";

// Spart med Vis: hvor mye tid og penger Vis har spart bedriften. Ren logikk uten database
// (tests/roi.test.ts). Tallene rundes alltid ned (kroner til nærmeste 1 000, timer til hele
// timer) og vises som «ca.» og «eks. mva». Annonser og byrå telles bare når bedriften selv har
// krysset av, og byråsummen vises for seg, aldri i hovedtallet.

export type { RoiSettings };
export type RoiValues = Required<RoiSettings>;

// Standardverdiene i «Slik regner vi» (kildene står i RoiPanel). agencyFee er en andel (0,15 = 15 %).
export const ROI_DEFAULTS: RoiValues = { hourlyCost: 650, salary: 650_000, agencyFee: 0.15, adPrice: 14_400 };

// Byråhonorar for én ansettelse, vanlig spenn (salgssidene).
export const AGENCY_FEE_RANGE = [0.15, 0.25] as const;

// Tid spart per ting.
export const ROI_RATES = {
  // Per søknad: fra ca. 3 min (skumlese CV, åpne GitHub) til ca. 1,5 min med strukturert profil.
  applicationMinutes: 1.5,
  // Per ansettelse: færre telefonsamtaler, case og intervjurunder (ca. 12,5 t, rundet ned).
  hireHours: 10,
  // Per intervju kandidaten booket selv: 243 → 27 min, rundet ned til en halvtime.
  interviewHours: 0.5,
  // Per statusmelding fra mal: ca. 2 min å skrive den selv.
  messageMinutes: 2,
} as const;

// Grenser for egne tall, så en skrivefeil ikke gir «spart 40 mill.».
export const ROI_LIMITS: Record<keyof RoiValues, readonly [number, number]> = {
  hourlyCost: [100, 3_000],
  salary: [200_000, 3_000_000],
  agencyFee: [0, 0.4],
  adPrice: [0, 50_000],
};

const clamp = (n: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, n));

// Gjør egne tall trygge: tall innenfor grensene, ellers standarden. Byråhonorar kan komme som
// prosent (15) eller andel (0,15).
export function clampRoiSettings(raw: unknown): RoiValues {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof RoiValues) => {
    const value = input[key];
    const n = typeof value === "string" ? Number(value.replace(/\s/g, "").replace(",", ".")) : Number(value);
    if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return ROI_DEFAULTS[key];
    if (key === "agencyFee") return Math.round(clamp(n > 1 ? n / 100 : n, ROI_LIMITS.agencyFee) * 1000) / 1000;
    return Math.round(clamp(n, ROI_LIMITS[key]));
  };
  return { hourlyCost: pick("hourlyCost"), salary: pick("salary"), agencyFee: pick("agencyFee"), adPrice: pick("adPrice") };
}

// Bare det som avviker fra standarden lagres, så nye standardtall slår gjennom. null = alt standard.
export function storedRoiSettings(raw: unknown): RoiSettings | null {
  const values = clampRoiSettings(raw);
  const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== ROI_DEFAULTS[key as keyof RoiValues]));
  return Object.keys(changed).length > 0 ? (changed as RoiSettings) : null;
}

// Tallene fra appen. Annonser og byrå er bare det bedriften selv har krysset av for.
export type RoiInput = {
  // A: mottatte søknader
  applications: number;
  // H: ansettelser (Marker som ansatt)
  hires: number;
  // B: intervjuer kandidaten booket selv
  interviews: number;
  // M: statusmeldinger sendt fra mal
  messages: number;
  // J: publiserte stillinger som erstattet en betalt annonse
  replacedAds: number;
  // Hb: ansettelser der dere ellers ville brukt byrå
  agencyHires: number;
  // Hva Bedrift koster i samme periode (kr), for «≈ N× abonnementsprisen».
  subscriptionCost?: number | null;
};

export type RoiPartKey = "applications" | "hires" | "interviews" | "messages" | "ads";
export type RoiPart = { key: RoiPartKey; count: number; hours: number; kroner: number };
export type Roi = { hours: number; kroner: number; agency: number; multiple: number | null; parts: RoiPart[] };

const count = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));
// Flyttall som 0,99999 skal ikke rundes ned til 0.
const floorTo = (n: number, step: number) => Math.floor(n / step + 1e-9) * step;

// timer = A·1,5/60 + H·10 + B·0,5 + M·2/60
// kr    = J·annonsepris + timer·timekost
// byrå  = Hb·årslønn·byråhonorar (vises for seg)
export function computeRoi(input: RoiInput, settings?: RoiSettings | null): Roi {
  const s = clampRoiSettings(settings ?? {});
  const a = count(input.applications);
  const h = count(input.hires);
  const b = count(input.interviews);
  const m = count(input.messages);
  const j = count(input.replacedAds);
  // Byrå kan bare unngås for ansettelser som faktisk er gjort.
  const hb = Math.min(count(input.agencyHires), h);

  const hourParts: [RoiPartKey, number, number][] = [
    ["applications", a, (a * ROI_RATES.applicationMinutes) / 60],
    ["hires", h, h * ROI_RATES.hireHours],
    ["interviews", b, b * ROI_RATES.interviewHours],
    ["messages", m, (m * ROI_RATES.messageMinutes) / 60],
  ];
  const parts: RoiPart[] = [
    ...hourParts.map(([key, n, hours]) => ({ key, count: n, hours, kroner: hours * s.hourlyCost })),
    { key: "ads", count: j, hours: 0, kroner: j * s.adPrice },
  ];
  const rawHours = hourParts.reduce((sum, [, , hours]) => sum + hours, 0);
  const kroner = floorTo(j * s.adPrice + rawHours * s.hourlyCost, 1000);
  const cost = Number(input.subscriptionCost) || 0;
  return {
    hours: floorTo(rawHours, 1),
    kroner,
    agency: floorTo(hb * s.salary * s.agencyFee, 1000),
    // Én desimal, rundet ned. Bare når det finnes en pris å sammenligne med.
    multiple: cost > 0 ? Math.floor((kroner / cost) * 10 + 1e-9) / 10 : null,
    parts,
  };
}
