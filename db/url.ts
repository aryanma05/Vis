// Neon gir tilkoblingsstrenger med ?channel_binding=require. postgres.js kjenner ikke
// igjen den parameteren og sender den videre til serveren som en innstilling, så vi
// fjerner den. Resten av strengen (inkl. sslmode=require) beholdes.
export function cleanDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.searchParams.delete("channel_binding");
    return url.toString();
  } catch {
    return raw;
  }
}
