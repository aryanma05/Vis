// Rettferdig ansettelse: finner ord som tyder på at man spør om, noterer eller vurderer noe
// loven ikke tillater (graviditet, religion, helse, alder osv.; LDL § 30, aml §§ 13-1 og 13-4).
// Bare en myk advarsel i notater, maler og stillingstekster; ingenting blokkeres.

// Hele ord (med vanlige bøyninger), ikke deler av lengre ord: «helse» treffer, «helseforsikring» ikke.
const TERMS = [
  "gravid(?:e|itet|iteten)?",
  "svangerskap(?:et)?",
  "barneplan(?:er|ene)?",
  "familieplan(?:er|ene|legging)?",
  "alder(?:en)?",
  "religion(?:en|er)?",
  "religiøs(?:e)?",
  "etnisitet(?:en)?",
  "hudfarge(?:n)?",
  "funksjonsnedsettelse(?:n|r)?",
  "diagnose(?:n|r)?",
  "sykdom(?:men|mer)?",
  "helse(?:n)?",
  "legning(?:en)?",
  "homofil(?:e)?",
  "kjønnsidentitet(?:en)?",
  "fagforening(?:en|er)?",
  "politisk(?:e)?",
];

const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(?:${TERMS.join("|")})(?![\\p{L}\\p{N}])`, "giu");

// Ordene som ble funnet, med små bokstaver, hvert ord én gang, i rekkefølgen de står.
export function findSensitiveTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(PATTERN)].map((m) => m[0].toLowerCase()))];
}
