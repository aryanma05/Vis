import "server-only";

// Søkerflyten. P3 fyller inn.

// Planlagt jobb (Bedrift): «N søkere har ventet over 7 dager», maks én e-post per person
// per døgn (regelen companyDigest), og bare til dem som har notificationPrefs.companyDigest på.
// Gir antall e-poster som ble sendt. P3 fyller inn.
export async function sendResponseDigests(): Promise<number> {
  return 0;
}
