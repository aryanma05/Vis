import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("For utviklere"),
    description: t("Åpent API for profiler, prosjekter og stillinger på Vis, og webhooks for bedrifter."),
  };
}

function Code({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink-2 p-4 font-mono text-[12.5px] leading-5 text-fg/90">{children}</pre>;
}

const mono = "font-mono";

export default async function DevelopersPage() {
  const t = await getT();
  const base = `${siteUrl()}/api/v1`;
  const user = t("ditt-brukernavn");
  const endpoints: [string, string][] = [
    [`GET /profiles/{${t("brukernavn")}}`, t("Profil, CV og publiserte prosjekter")],
    [`GET /profiles/{${t("brukernavn")}}/projects`, t("Bare prosjektene")],
    ["GET /projects?q=&tag=&featured=true&limit=24", t("Søk i prosjekter (nyeste først uten q)")],
    ["GET /projects/{id}", t("Ett prosjekt med beskrivelse (markdown), bilder og lenker")],
    ["GET /jobs?q=&type=&remote=&limit=24", t("Ledige stillinger")],
    ["GET /jobs/{id}", t("Én stilling")],
    ["GET /companies/{slug}", t("En bedrift med ledige stillinger")],
  ];

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <article className="mx-auto max-w-3xl">
        <p className="caption">{t("For utviklere")}</p>
        <h1 className="display mt-3 text-[clamp(2.2rem,5vw,3.6rem)]">{t("API og webhooks")}</h1>
        <p className="mt-4 text-lg leading-8 text-mist">
          {t("Alt som er offentlig på Vis kan hentes som JSON: vis prosjektene dine på din egen nettside, lag en oversikt over stillinger, eller bygg noe vi ikke har tenkt på.")}
        </p>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">{t("Kom i gang")}</h2>
          <p className="mt-3 text-mist">
            {t("Grunnadressen er")} <code className={`${mono} text-fg`}>{base}</code>.{" "}
            {t("Ingen nøkkel trengs for å lese. Svarene har CORS åpent, så du kan kalle API-et rett fra nettleseren.")}
          </p>
          <Code>{`curl ${base}/profiles/${user}`}</Code>
          <p className="mt-6 text-mist">{t("Vis de nyeste prosjektene dine på din egen nettside:")}</p>
          <Code>{`const res = await fetch("${base}/profiles/${user}/projects");
const { data } = await res.json();
for (const project of data.slice(0, 3)) {
  console.log(project.title, project.url, project.coverImage);
}`}</Code>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">{t("Endepunkter")}</h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {endpoints.map(([path, what]) => (
              <li key={path} className="px-5 py-3">
                <code className={`${mono} text-[13px] text-fg`}>{path}</code>
                <p className="text-sm text-mist">{what}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-mist">
            {t("Lister ligger i")} <code className={mono}>data</code>. {t("Feil har formen")}{" "}
            <code className={mono}>{`{ "error": { "status": 404, "message": "…" } }`}</code>.{" "}
            {t("Utkast, skjulte og fjernede prosjekter finnes ikke i API-et, og e-postadresser vises aldri.")}
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">{t("Grenser og nøkler")}</h2>
          <p className="mt-3 text-mist">
            {t("Uten nøkkel: 120 kall i minuttet per IP-adresse. Med nøkkel: 1 200 i minuttet. Lag en under")}{" "}
            <Link href="/profil/rediger/konto#utviklere" className="text-ice hover:underline">
              {t("Konto → Utviklere")}
            </Link>{" "}
            {t("og send den slik:")}
          </p>
          <Code>{`curl -H "Authorization: Bearer vis_…" ${base}/jobs`}</Code>
          <p className="mt-3 text-sm text-mist">
            {t("Hvert svar har")} <code className={mono}>X-RateLimit-Limit</code>, <code className={mono}>X-RateLimit-Remaining</code> {t("og")}{" "}
            <code className={mono}>X-RateLimit-Reset</code>. {t("Over grensen får du 429 med")} <code className={mono}>Retry-After</code>.
          </p>
        </section>

        <section id="webhooks" className="mt-12 scroll-mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">{t("Webhooks for bedrifter")}</h2>
          <p className="mt-3 text-mist">
            {t("Med Bedrift-abonnementet kan dere få beskjed når noe skjer med stillingene, f.eks. for å koble Vis til rekrutteringssystemet. Legg til en adresse under Administrer → Webhooks.")}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {Object.entries(WEBHOOK_EVENTS).map(([event, label]) => (
              <li key={event}>
                <code className={`${mono} text-fg`}>{event}</code> <span className="text-mist">– {t(label)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-mist">{t("Hver levering er en POST med JSON:")}</p>
          <Code>{`{
  "id": "evt_…",
  "type": "job.published",
  "created": "2026-10-04T08:00:00.000Z",
  "data": { "job": { "id": "…", "title": "${t("Frontend-utvikler")}", "status": "published", "url": "${siteUrl()}/stillinger/…" } }
}`}</Code>
          <p className="mt-4 text-mist">
            {t("Sjekk at den kommer fra oss med")} <code className={mono}>Vis-Signature</code> (
            <code className={mono}>{t("t=tid,v1=HMAC-SHA256 av «tid.innhold»")}</code> {t("med hemmeligheten dere fikk):")}
          </p>
          <Code>{`import { createHmac, timingSafeEqual } from "node:crypto";

function verify(body, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${body}\`).digest("hex");
  return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
}`}</Code>
          <p className="mt-3 text-sm text-mist">{t("Svar med 2xx innen 10 sekunder. Ved 5xx eller tidsavbrudd prøver vi igjen to ganger. Omdirigeringer følges ikke.")}</p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">{t("Merke og innbygging")}</h2>
          <p className="mt-3 text-mist">
            {t("Uten kode: bruk «Del» på profilen eller et prosjekt for et merke til GitHub-README")} (<code className={mono}>/api/merke/{t("brukernavn")}</code>){" "}
            {t("eller et kort du kan bygge inn med en iframe")} (<code className={mono}>/bygg-inn/profil/{t("brukernavn")}</code>).
          </p>
        </section>
      </article>
    </main>
  );
}
