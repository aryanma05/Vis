// Banneret øverst på profilen og kjæledyret. Brukes både i databasen (typer),
// i valideringen og i nettleseren, så filen har ingen avhengigheter.

/* -------------------------------------------------------------------------- */
/*  Banner                                                                    */
/* -------------------------------------------------------------------------- */

export const BANNER_GRADIENTS = {
  nordlys: { label: "Nordlys", css: "linear-gradient(115deg, #052e2b 0%, #0f766e 30%, #2dd4bf 52%, #8b5cf6 78%, #1e1b4b 100%)" },
  solnedgang: { label: "Solnedgang", css: "linear-gradient(115deg, #3b0764 0%, #be185d 38%, #fb923c 72%, #fde68a 100%)" },
  hav: { label: "Hav", css: "linear-gradient(115deg, #020617 0%, #0c4a6e 40%, #0891b2 75%, #a5f3fc 100%)" },
  skog: { label: "Skog", css: "linear-gradient(115deg, #052e16 0%, #166534 45%, #65a30d 80%, #d9f99d 100%)" },
  lavendel: { label: "Lavendel", css: "linear-gradient(115deg, #312e81 0%, #7c3aed 40%, #c4b5fd 75%, #fae8ff 100%)" },
  fersken: { label: "Fersken", css: "linear-gradient(115deg, #fff7ed 0%, #fed7aa 35%, #fda4af 70%, #f0abfc 100%)" },
  grafitt: { label: "Grafitt", css: "linear-gradient(115deg, #09090b 0%, #27272a 50%, #52525b 100%)" },
  is: { label: "Is", css: "linear-gradient(115deg, #071a52 0%, #1d4ed8 45%, #7dd3fc 80%, #ecfeff 100%)" },
} as const;
export type BannerGradient = keyof typeof BANNER_GRADIENTS;
export const BANNER_GRADIENT_KEYS = Object.keys(BANNER_GRADIENTS) as [BannerGradient, ...BannerGradient[]];

export const BANNER_PATTERNS = {
  prikker: "Prikker",
  rutenett: "Rutenett",
  striper: "Striper",
  bolger: "Bølger",
  topografi: "Topografi",
  sjakk: "Sjakk",
  sirkler: "Sirkler",
  pluss: "Pluss",
} as const;
export type BannerPattern = keyof typeof BANNER_PATTERNS;
export const BANNER_PATTERN_KEYS = Object.keys(BANNER_PATTERNS) as [BannerPattern, ...BannerPattern[]];

// Ferdige illustrasjoner, tegnet som SVG (components/profile/banner-art.tsx).
export const BANNER_ARTS = {
  fjell: "Fjell i solnedgang",
  nordlys: "Nordlys",
  blakopi: "Blåkopi",
  terminal: "Terminal",
  havet: "Havet",
  byen: "Byen om natten",
  kosmos: "Verdensrommet",
  synth: "Synthwave",
  lekent: "Lekent",
} as const;
export type BannerArt = keyof typeof BANNER_ARTS;
export const BANNER_ART_KEYS = Object.keys(BANNER_ARTS) as [BannerArt, ...BannerArt[]];

// Fargene man kan velge for ensfarget banner og mønster (pluss en egen farge).
export const BANNER_COLORS = [
  "#071a52",
  "#1d4ed8",
  "#0e7490",
  "#047857",
  "#4d7c0f",
  "#b45309",
  "#be123c",
  "#7e22ce",
  "#18181b",
  "#c7f9ff",
  "#9fe0a8",
  "#ffc27a",
  "#ff9fb5",
  "#b9a6ff",
] as const;

export type BannerConfig =
  | { type: "accent" }
  | { type: "color"; color: string }
  | { type: "gradient"; gradient: BannerGradient }
  | { type: "pattern"; pattern: BannerPattern; color: string }
  | { type: "art"; art: BannerArt }
  // `y` er hvilken del av bildet som vises (0 = toppen, 100 = bunnen).
  | { type: "image"; url: string; y: number };

// Lys farge? Da trenger mønsteret mørke streker.
export function isLightColor(hex: string) {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/* -------------------------------------------------------------------------- */
/*  Kjæledyr                                                                  */
/* -------------------------------------------------------------------------- */

export const PET_SPECIES = {
  katt: { label: "Katt", color: "oransje", sound: "Mjau!" },
  hund: { label: "Hund", color: "brun", sound: "Voff!" },
  rev: { label: "Rev", color: "oransje", sound: "Ring-ding-ding!" },
  kanin: { label: "Kanin", color: "hvit", sound: "*nese-vrikk*" },
  bjorn: { label: "Bjørn", color: "brun", sound: "Brumm!" },
  panda: { label: "Panda", color: "hvit", sound: "*tygger bambus*" },
  ugle: { label: "Ugle", color: "lilla", sound: "Hoo-hoo!" },
  robot: { label: "Robot", color: "bla", sound: "Bip-bop!" },
} as const;
export type PetSpecies = keyof typeof PET_SPECIES;
export const PET_SPECIES_KEYS = Object.keys(PET_SPECIES) as [PetSpecies, ...PetSpecies[]];

// `body` er hovedfargen, `shade` skygger og føtter, `belly` magen og snuten.
export const PET_COLORS = {
  oransje: { label: "Oransje", body: "#f5a05a", shade: "#d97a33", belly: "#ffe6cc" },
  brun: { label: "Brun", body: "#b0835f", shade: "#8a5f40", belly: "#f2e0cd" },
  gra: { label: "Grå", body: "#a3acbd", shade: "#7a8396", belly: "#eceff4" },
  hvit: { label: "Hvit", body: "#f6f3ee", shade: "#d3cbbf", belly: "#ffffff" },
  svart: { label: "Svart", body: "#43434f", shade: "#2a2a33", belly: "#8d8d9c" },
  bla: { label: "Blå", body: "#82bbff", shade: "#5592e0", belly: "#e0eeff" },
  mint: { label: "Mint", body: "#85e3c4", shade: "#52c09d", belly: "#e2fbf2" },
  rosa: { label: "Rosa", body: "#ffa6c4", shade: "#e7789f", belly: "#ffe4ee" },
  lilla: { label: "Lilla", body: "#bba9ff", shade: "#8e78ea", belly: "#eee8ff" },
  gull: { label: "Gull", body: "#ffd36e", shade: "#e2aa3b", belly: "#fff3cf" },
} as const;
export type PetColor = keyof typeof PET_COLORS;
export const PET_COLOR_KEYS = Object.keys(PET_COLORS) as [PetColor, ...PetColor[]];

// Noe tilbehør må låses opp med en prestasjon (nøkkel og nivå i lib/achievement-defs.ts).
export const PET_ACCESSORIES = {
  ingen: { label: "Ingenting" },
  sloyfe: { label: "Sløyfe" },
  caps: { label: "Caps" },
  lue: { label: "Lue" },
  briller: { label: "Briller" },
  hodetelefoner: { label: "Hodetelefoner" },
  skjerf: { label: "Skjerf" },
  partyhatt: { label: "Partyhatt" },
  blomst: { label: "Blomst" },
  doktorhatt: { label: "Doktorhatt", requires: { key: "byggmester", tier: 1 } },
  krone: { label: "Krone", requires: { key: "stjernestov", tier: 2 } },
} as const satisfies Record<string, { label: string; requires?: { key: string; tier: number } }>;
export type PetAccessory = keyof typeof PET_ACCESSORIES;
export const PET_ACCESSORY_KEYS = Object.keys(PET_ACCESSORIES) as [PetAccessory, ...PetAccessory[]];

export type PetConfig = {
  species: PetSpecies;
  color: PetColor;
  accessory: PetAccessory;
  name: string;
};

export const PET_NAME_MAX = 20;

export const defaultPet = (species: PetSpecies = "katt"): PetConfig => ({
  species,
  color: PET_SPECIES[species].color,
  accessory: "ingen",
  name: "",
});
