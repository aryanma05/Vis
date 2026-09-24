// @omtaler i kommentarer. Ren logikk, brukes både på serveren og i nettleseren.

// @brukernavn: starter og slutter med bokstav/tall, kan ha - _ . i midten (som lib/username.ts).
export const MENTION = /(^|[^\w@./])@([a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,37}[a-zA-Z0-9])?)/g;

export function extractMentions(text: string, max = 10): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION)) {
    found.add(match[2].toLowerCase());
    if (found.size >= max) break;
  }
  return [...found];
}

// Deler opp tekst i biter: vanlig tekst, @omtaler og lenker. Brukes av RichText.
export type Segment = { type: "text"; value: string } | { type: "mention"; username: string } | { type: "link"; url: string };

const TOKEN = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|(?:^|(?<=[^\w@./]))@([a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,37}[a-zA-Z0-9])?)/g;

export function segment(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ type: "text", value: text.slice(last, index) });
    if (m[1]) out.push({ type: "link", url: m[1] });
    else out.push({ type: "mention", username: m[2] });
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}
