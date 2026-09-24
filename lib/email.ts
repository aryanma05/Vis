// Fanger vanlige skrivefeil i e-postadresser før de sendes, så folk ikke ender med en
// konto på "arin@gmial.com" som de aldri får logget inn på igjen.

const COMMON_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.no",
  "outlook.com",
  "live.no",
  "live.com",
  "icloud.com",
  "me.com",
  "yahoo.com",
  "online.no",
];

// Kort avstand mellom to strenger (antall tegn som må legges til, fjernes eller byttes).
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = current;
    }
  }
  return row[b.length];
}

// "arin@gmial.com" -> "arin@gmail.com". null hvis adressen ser riktig ut.
export function emailSuggestion(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;

  // "gmail" uten ".com"
  const bare = COMMON_DOMAINS.find((d) => d.split(".")[0] === domain);
  if (bare) return `${local}@${bare}`;

  const closest = COMMON_DOMAINS.map((d) => ({ d, dist: distance(domain, d) })).sort((x, y) => x.dist - y.dist)[0];
  return closest.dist <= 2 ? `${local}@${closest.d}` : null;
}

// Samme sjekk som serveren gjør, så feilen vises ved feltet i stedet for etter innsending.
// Nettleserens egen sjekk godtar "arin@gmail" (uten .com), det gjør ikke serveren.
export function emailError(email: string): string | null {
  if (!email) return "Skriv inn e-posten din.";
  if (/\s/.test(email)) return "E-postadressen kan ikke ha mellomrom.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return email.includes("@")
      ? "E-postadressen mangler noe, f.eks. .com eller .no på slutten."
      : "E-postadressen må ha med @.";
  }
  return null;
}
