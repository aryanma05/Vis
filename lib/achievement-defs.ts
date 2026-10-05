// Prestasjoner, som på GitHub: merker man låser opp ved å bruke Vis. Mange har nivåer
// (×2 bronse, ×3 sølv, ×4 gull) som låses opp ved høyere tall. Selve tellingen skjer
// på serveren (lib/achievements.ts); her ligger det som også trengs i nettleseren.

export type AchievementStat =
  | "published"
  | "reactions"
  | "useful"
  | "followers"
  | "comments"
  | "team"
  | "updates"
  | "featured"
  | "tags"
  | "code"
  | "stories"
  | "views"
  | "profileComplete"
  | "cv"
  | "nightOwl"
  | "pioneer"
  | "pet";

export type AchievementIcon =
  | "shovel"
  | "hammer"
  | "sparkles"
  | "lightbulb"
  | "users"
  | "messages"
  | "handshake"
  | "notebook"
  | "trophy"
  | "wrench"
  | "branch"
  | "book"
  | "eye"
  | "idcard"
  | "briefcase"
  | "moon"
  | "rocket"
  | "paw";

export type AchievementPattern = "rays" | "dots" | "rings" | "grid" | "waves";

export type AchievementDef = {
  key: string;
  name: string;
  // Hva som skal til. {n} er tallet for neste nivå; `goalOne` brukes når det er 1.
  goal: string;
  goalOne?: string;
  // En liten linje om hva merket betyr.
  about: string;
  stat: AchievementStat;
  // Grensene for hvert nivå. Ett tall betyr at merket ikke har nivåer.
  tiers: number[];
  icon: AchievementIcon;
  colors: [string, string];
  pattern: AchievementPattern;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "forste-prosjekt",
    name: "Første spadetak",
    goal: "Publiser ditt første prosjekt.",
    about: "Alt stort starter med ett prosjekt.",
    stat: "published",
    tiers: [1],
    icon: "shovel",
    colors: ["#5eead4", "#0f766e"],
    pattern: "rays",
  },
  {
    key: "byggmester",
    name: "Byggmester",
    goal: "Publiser {n} prosjekter.",
    about: "Du bygger, og du viser det frem.",
    stat: "published",
    tiers: [3, 10, 25, 50],
    icon: "hammer",
    colors: ["#ffb35c", "#d9480f"],
    pattern: "grid",
  },
  {
    key: "stjernestov",
    name: "Stjernestøv",
    goal: "Få {n} reaksjoner på prosjektene dine.",
    about: "Folk liker det de ser.",
    stat: "reactions",
    tiers: [5, 25, 100, 500],
    icon: "sparkles",
    colors: ["#c4b5fd", "#4c3bd6"],
    pattern: "dots",
  },
  {
    key: "til-stor-hjelp",
    name: "Til stor hjelp",
    goal: "Få {n} «Nyttig»-reaksjoner.",
    about: "Det du deler, hjelper andre videre.",
    stat: "useful",
    tiers: [3, 15, 50],
    icon: "lightbulb",
    colors: ["#ffe066", "#e67700"],
    pattern: "rays",
  },
  {
    key: "publikumsfavoritt",
    name: "Publikumsfavoritt",
    goal: "Få {n} følgere.",
    about: "Folk vil se hva du lager neste gang.",
    stat: "followers",
    tiers: [5, 25, 100, 500],
    icon: "users",
    colors: ["#ffa8c5", "#c2255c"],
    pattern: "rings",
  },
  {
    key: "samtalestarter",
    name: "Samtalestarter",
    goal: "Skriv {n} kommentarer på andres prosjekter.",
    about: "Gode spørsmål og ærlige tilbakemeldinger.",
    stat: "comments",
    tiers: [3, 15, 50, 150],
    icon: "messages",
    colors: ["#8ccbff", "#1c5fd4"],
    pattern: "waves",
  },
  {
    key: "lagspiller",
    name: "Lagspiller",
    goal: "Vær med på {n} prosjekter med et team.",
    goalOne: "Lag et prosjekt sammen med andre.",
    about: "Det beste lages sammen.",
    stat: "team",
    tiers: [1, 3, 10],
    icon: "handshake",
    colors: ["#b2f2bb", "#2b8a3e"],
    pattern: "dots",
  },
  {
    key: "dagbokskriver",
    name: "Dagbokskriver",
    goal: "Skriv {n} oppdateringer på prosjektene dine.",
    goalOne: "Skriv en oppdatering på et prosjekt.",
    about: "Prosjektet lever, og du forteller om det.",
    stat: "updates",
    tiers: [1, 5, 20],
    icon: "notebook",
    colors: ["#ffc078", "#b3461b"],
    pattern: "grid",
  },
  {
    key: "redaksjonens-valg",
    name: "Redaksjonens valg",
    goal: "Få {n} prosjekter valgt ut av redaksjonen.",
    goalOne: "Få et prosjekt valgt ut av redaksjonen.",
    about: "Noe du laget, fikk plass øverst på forsiden.",
    stat: "featured",
    tiers: [1, 3],
    icon: "trophy",
    colors: ["#ffe08a", "#a86b00"],
    pattern: "rays",
  },
  {
    key: "verktoykassa",
    name: "Verktøykassa",
    goal: "Bruk {n} ulike teknologier i prosjektene dine.",
    about: "Du er ikke redd for å lære noe nytt.",
    stat: "tags",
    tiers: [5, 15, 30],
    icon: "wrench",
    colors: ["#66d9e8", "#0b7285"],
    pattern: "grid",
  },
  {
    key: "apen-bok",
    name: "Åpen bok",
    goal: "Del {n} prosjekter med lenke til koden.",
    goalOne: "Del et prosjekt med lenke til koden.",
    about: "Alle kan se under panseret.",
    stat: "code",
    tiers: [1, 5, 15],
    icon: "branch",
    colors: ["#d0bfff", "#6741d9"],
    pattern: "waves",
  },
  {
    key: "historieforteller",
    name: "Historieforteller",
    goal: "Skriv en grundig README (300+ ord) på {n} prosjekter.",
    goalOne: "Skriv en grundig README (300+ ord) på et prosjekt.",
    about: "Historien bak gjør prosjektet levende.",
    stat: "stories",
    tiers: [1, 3, 10],
    icon: "book",
    colors: ["#ffb3bf", "#c2253d"],
    pattern: "rings",
  },
  {
    key: "i-rampelyset",
    name: "I rampelyset",
    goal: "Få {n} visninger på prosjektene dine.",
    about: "Mange har stoppet opp ved det du har laget.",
    stat: "views",
    tiers: [100, 1000, 10000, 50000],
    icon: "eye",
    colors: ["#99e9f2", "#0c7c99"],
    pattern: "rays",
  },
  {
    key: "visittkortet",
    name: "Visittkortet",
    goal: "Legg til bilde, tittel, bosted, kort om deg og en lenke på profilen.",
    about: "Førsteinntrykket sitter.",
    stat: "profileComplete",
    tiers: [1],
    icon: "idcard",
    colors: ["#bac8ff", "#3b4bc4"],
    pattern: "dots",
  },
  {
    key: "klar-for-jobb",
    name: "Klar for neste jobb",
    goal: "Legg til erfaring eller utdanning i CV-en.",
    about: "CV-en ligger klar når muligheten dukker opp.",
    stat: "cv",
    tiers: [1],
    icon: "briefcase",
    colors: ["#8ce99a", "#1f7a3a"],
    pattern: "grid",
  },
  {
    key: "nattugle",
    name: "Nattugle",
    goal: "Publiser et prosjekt mellom midnatt og klokka fem.",
    about: "De beste ideene kommer når alle andre sover.",
    stat: "nightOwl",
    tiers: [1],
    icon: "moon",
    colors: ["#9775fa", "#1b1542"],
    pattern: "dots",
  },
  {
    key: "pioner",
    name: "Pioner",
    goal: "Bli en av de 500 første på Vis.",
    about: "Du var her fra starten.",
    stat: "pioneer",
    tiers: [1],
    icon: "rocket",
    colors: ["#ffa94d", "#86300f"],
    pattern: "rays",
  },
  {
    key: "dyrevenn",
    name: "Dyrevenn",
    goal: "Adopter et kjæledyr til profilen.",
    about: "Profilen har fått en liten venn.",
    stat: "pet",
    tiers: [1],
    icon: "paw",
    colors: ["#fcc2d7", "#a61e4d"],
    pattern: "dots",
  },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

// Nivå 1 er grunnmerket; 2, 3 og 4 vises som ×2 (bronse), ×3 (sølv) og ×4 (gull).
export const TIER_NAMES = ["", "Bronse", "Sølv", "Gull"] as const;
export const TIER_COLORS = ["", "#d08a4e", "#c3ccd8", "#f5c542"] as const;

// Hvor mange nivåer et tall gir (0 = ikke låst opp).
export function tierFor(def: AchievementDef, value: number) {
  return def.tiers.filter((threshold) => value >= threshold).length;
}

// Teksten for hva som skal til for nivå `tier` (1-basert).
export function goalText(def: AchievementDef, tier: number) {
  const n = def.tiers[Math.min(tier, def.tiers.length) - 1] ?? def.tiers[0];
  return { text: n === 1 && def.goalOne ? def.goalOne : def.goal, n };
}

// Det en profil sender til nettleseren for hvert merke.
export type AchievementState = {
  key: string;
  tier: number;
  unlockedAt: string | null;
  // Bare for eieren selv: tallet merket teller, for fremdriften mot neste nivå.
  value: number | null;
  seen: boolean;
};
