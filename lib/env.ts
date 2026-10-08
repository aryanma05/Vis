// Sjekker at oppsettet (miljøvariablene) er komplett før lansering. Brukes når serveren
// starter (instrumentation.ts) og vises som en sjekkliste for admin under /admin?fane=system.
// Leser bare om variablene finnes – verdiene vises aldri.

export type EnvStatus = "ok" | "info" | "warn" | "error";
export type EnvCheck = { key: string; group: string; status: EnvStatus; message: string };

type Env = Record<string, string | undefined>;

const has = (env: Env, key: string) => Boolean(env[key]?.trim());

export function checkEnv(env: Env = process.env): EnvCheck[] {
  const prod = env.NODE_ENV === "production";
  const out: EnvCheck[] = [];
  const add = (group: string, key: string, status: EnvStatus, message: string) => out.push({ group, key, status, message });

  // Grunnleggende
  add("Grunnleggende", "DATABASE_URL", has(env, "DATABASE_URL") ? "ok" : "error", has(env, "DATABASE_URL") ? "Databasen er satt opp." : "Mangler. Appen kan ikke starte uten database.");

  const secret = env.BETTER_AUTH_SECRET?.trim() ?? "";
  add(
    "Grunnleggende",
    "BETTER_AUTH_SECRET",
    secret.length >= 32 ? "ok" : prod ? "error" : "warn",
    secret.length >= 32 ? "Satt." : secret ? "For kort. Bruk minst 32 tegn (openssl rand -base64 32)." : "Mangler. Innlogginger kan ikke signeres sikkert.",
  );

  const url = env.BETTER_AUTH_URL ?? env.RENDER_EXTERNAL_URL;
  let urlStatus: EnvStatus = "ok";
  let urlMessage = `Appen kjører på ${url}.`;
  if (!url) {
    urlStatus = prod ? "error" : "info";
    urlMessage = "Mangler. Lenker i e-poster og delingsbilder peker til localhost.";
  } else if (prod && !url.startsWith("https://")) {
    urlStatus = "warn";
    urlMessage = "Bør starte med https:// i produksjon.";
  } else if (!env.BETTER_AUTH_URL && prod) {
    urlStatus = "info";
    urlMessage = `Bruker Render-adressen (${url}). Sett BETTER_AUTH_URL når dere får eget domene.`;
  }
  add("Grunnleggende", "BETTER_AUTH_URL", urlStatus, urlMessage);

  const admins = has(env, "ADMIN_EMAILS");
  add("Grunnleggende", "ADMIN_EMAILS", admins ? "ok" : "warn", admins ? "Admin-kontoer er satt." : "Ingen admin-e-poster. Noen må kunne moderere rapporter.");

  // E-post
  const emailKey = has(env, "BREVO_API_KEY") || has(env, "RESEND_API_KEY");
  add(
    "E-post",
    "BREVO_API_KEY / RESEND_API_KEY",
    emailKey ? "ok" : prod ? "error" : "info",
    emailKey ? "E-post kan sendes." : "Mangler. Uten e-post kan ingen bekrefte kontoen eller få nytt passord.",
  );
  add("E-post", "EMAIL_FROM", has(env, "EMAIL_FROM") ? "ok" : emailKey ? "warn" : "info", has(env, "EMAIL_FROM") ? "Avsender er satt." : "Mangler avsenderadresse (f.eks. «Vis <hei@vis.no>»).");
  add("E-post", "CONTACT_EMAIL", has(env, "CONTACT_EMAIL") ? "ok" : prod ? "warn" : "info", has(env, "CONTACT_EMAIL") ? "Vises på /personvern og /vilkar." : "Mangler. Personvernerklæringen må ha en kontaktadresse.");

  // Innhold og integrasjoner
  add(
    "Integrasjoner",
    "GITHUB_TOKEN",
    has(env, "GITHUB_TOKEN") ? "ok" : prod ? "error" : "info",
    has(env, "GITHUB_TOKEN")
      ? "GitHub-import har høy grense. Se «GitHub-import» øverst for om tokenet virker."
      : "Mangler. Uten token deler appen 60 kall i timen med alle andre på samme IP-adresse, så GitHub-import feiler i praksis.",
  );
  const github = has(env, "GITHUB_CLIENT_ID") && has(env, "GITHUB_CLIENT_SECRET");
  add("Integrasjoner", "GITHUB_CLIENT_ID", github ? "ok" : "info", github ? "Innlogging med GitHub er på." : "Innlogging med GitHub er av.");
  const google = has(env, "GOOGLE_CLIENT_ID") && has(env, "GOOGLE_CLIENT_SECRET");
  add("Integrasjoner", "GOOGLE_CLIENT_ID", google ? "ok" : "info", google ? "Innlogging med Google er på." : "Innlogging med Google er av.");
  add("Integrasjoner", "BLOB_READ_WRITE_TOKEN", has(env, "BLOB_READ_WRITE_TOKEN") ? "ok" : "info", has(env, "BLOB_READ_WRITE_TOKEN") ? "Filer lagres i Vercel Blob." : "Filer lagres i databasen. Greit i starten; følg med på databasestørrelsen.");
  const ownBrowser = has(env, "SCREENSHOT_BROWSER_PATH");
  add(
    "Integrasjoner",
    "MICROLINK_API_KEY",
    ownBrowser || has(env, "MICROLINK_API_KEY") ? "ok" : "info",
    ownBrowser ? "Skjermbilder tas med egen nettleser." : has(env, "MICROLINK_API_KEY") ? "Skjermbilder via Microlink med nøkkel." : "Skjermbilder via Microlink uten nøkkel: 50 sider i døgnet for hele appen.",
  );
  add(
    "Integrasjoner",
    "CRON_SECRET",
    has(env, "CRON_SECRET") ? "ok" : "warn",
    has(env, "CRON_SECRET")
      ? "Planlagte jobber er beskyttet. Husk å kalle /api/cron/ukesoppsummering (mandager) og /api/cron/daglig (hver dag)."
      : "Mangler. Ukesoppsummeringen og varsler om lagrede kandidatsøk sendes ikke, og gamle søknader slettes ikke.",
  );

  // Betaling
  const stripe = has(env, "STRIPE_SECRET_KEY");
  if (!stripe) {
    add("Betaling", "STRIPE_SECRET_KEY", "info", "Betaling er av. Pro og Bedrift kan bare gis av admin.");
  } else {
    const live = env.STRIPE_SECRET_KEY!.startsWith("sk_live_");
    add("Betaling", "STRIPE_SECRET_KEY", prod && !live ? "warn" : "ok", live ? "Live-nøkkel." : "Testnøkkel. Ingen ekte betalinger.");
    add("Betaling", "STRIPE_WEBHOOK_SECRET", has(env, "STRIPE_WEBHOOK_SECRET") ? "ok" : "error", has(env, "STRIPE_WEBHOOK_SECRET") ? "Webhooken er satt opp." : "Mangler. Betalinger blir ikke registrert.");
    for (const key of ["STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_YEARLY", "STRIPE_PRICE_BUSINESS_MONTHLY"]) {
      add("Betaling", key, has(env, key) ? "ok" : "warn", has(env, key) ? "Pris er satt." : "Mangler pris-ID fra Stripe. Planen kan ikke kjøpes.");
    }
  }

  // Statistikk
  const analytics = has(env, "NEXT_PUBLIC_PLAUSIBLE_DOMAIN") || has(env, "NEXT_PUBLIC_UMAMI_WEBSITE_ID");
  add("Statistikk", "NEXT_PUBLIC_PLAUSIBLE_DOMAIN / NEXT_PUBLIC_UMAMI_WEBSITE_ID", analytics ? "ok" : "info", analytics ? "Besøksstatistikk uten informasjonskapsler er på." : "Ingen besøksstatistikk. Nøkkeltallene i admin virker likevel.");

  return out;
}

export const envProblems = (env?: Env) => checkEnv(env).filter((c) => c.status === "error" || c.status === "warn");
