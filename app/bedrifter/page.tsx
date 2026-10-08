import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, BellRing, Building2, Check, Columns3, Eye, GraduationCap, Plus, ShieldCheck, Trophy, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getDisplayPrices } from "@/lib/billing";
import { listCompanies, listMyCompanies } from "@/lib/companies";
import { getCurrentUser } from "@/lib/session";
import { getLocale } from "@/lib/i18n/server";
import { makeT, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLocale());
  return {
    title: t("Bedrifter"),
    description: t("Se hva utviklere og designere faktisk har laget før du kaller dem inn. Legg ut en stilling gratis, og la folk søke med Vis-profilen."),
  };
}

const money = (locale: Locale, amount: number) =>
  locale === "en" ? `NOK ${amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : `${amount.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr`;

// Eksempelet i kostnadssammenligningen: en utvikler med 700 000 kr i årslønn.
const SALARY = 700_000;

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="rounded-[22px] glass-card p-5">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-fill text-ice">{icon}</span>
      <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-mist">{children}</p>
    </li>
  );
}

// Salgssiden for bedrifter øverst, katalogen over bedrifter under. Budskapet: en CV viser
// ikke hva folk kan, men det gjør prosjektene. Bygget for små og mellomstore tech-bedrifter
// uten HR-avdeling og uten råd til byrå.
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [user, locale, prices] = await Promise.all([getCurrentUser(), getLocale(), getDisplayPrices()]);
  const t = makeT(locale);
  const [companies, mine] = await Promise.all([listCompanies({ q }), user ? listMyCompanies(user.id) : []]);
  const createHref = user ? "/bedrifter/ny" : "/register?neste=/bedrifter/ny";
  const monthly = prices["business:month"].amount;
  const yearly = monthly * 12;
  const agency = [SALARY * 0.15, SALARY * 0.25];
  const years = Math.floor(agency[0] / yearly);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        {mine.length > 0 && (
          <section className="mb-10">
            <h2 className="caption">{t("Dine bedrifter")}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link href={`/bedrift/${c.slug}/admin`} className="inline-flex items-center gap-2 rounded-full glass-chip px-4 py-2 text-sm font-medium hover:bg-fill-2">
                    {c.name} <span className="text-mist">· {t("administrer")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Hero */}
        <section className="max-w-3xl">
          <p className="caption">{t("For arbeidsgivere")}</p>
          <h1 className="display mt-3 text-[clamp(2.4rem,5.5vw,4.2rem)]">{t("Se hva de har laget før du kaller dem inn.")}</h1>
          <p className="mt-5 text-lg leading-8 text-mist">
            {t("En CV sier «React, 3 år». Det kan bety alt. På Vis ser du prosjektene, koden og hva personen faktisk har gjort, og alle søkere står i samme format.")}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <ButtonLink href={createHref} size="lg">
              <Plus className="size-4" /> {t("Lag bedriftsside gratis")}
            </ButtonLink>
            <ButtonLink href="#priser" variant="secondary" size="lg">
              {t("Se priser")}
            </ButtonLink>
          </div>
          <p className="mt-3 text-sm text-mist">{t("Én stilling er gratis. Ingen bindingstid.")}</p>
        </section>

        {/* Hva dere får */}
        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("Bygget for å vurdere ekte arbeid, raskt og billig")}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<Eye className="size-5" />} title={t("Ekte arbeid, ikke buzzwords")}>
              {t("Prosjekter med skjermbilder, kode og GitHub-tall, hvilken rolle personen hadde, og hvilke teknologier som faktisk er brukt, ikke bare listet opp.")}
            </Feature>
            <Feature icon={<Columns3 className="size-5" />} title={t("Alle søkere i samme format")}>
              {t("Folk søker med Vis-profilen med ett klikk. Flytt dem fra Ny til Intervju, Tilbud eller Avslag, sammenlign side om side, og kandidaten får beskjed automatisk.")}
            </Feature>
            <Feature icon={<BellRing className="size-5" />} title={t("Finn dem som ikke søker")}>
              {t("Søk blant folk som har sagt ja til å bli funnet, og lagre søket. Dere får e-post når nye passer, f.eks. «3 nye designere i Bergen».")}
            </Feature>
            <Feature icon={<GraduationCap className="size-5" />} title={t("Studenter og juniorer")}>
              {t("Filtrer på dem som er åpne for sommerjobb og internship, med studieretning og år. Perfekt etter karrieredagen.")}
            </Feature>
            <Feature icon={<Trophy className="size-5" />} title={t("Utfordringer i stedet for kodetester")}>
              {t("Legg ut en liten oppgave, og la folk svare med et prosjekt. Rettferdigere enn en test, og dere ser hvordan de faktisk jobber.")}
            </Feature>
            <Feature icon={<Users className="size-5" />} title={t("Employer branding utviklere tror på")}>
              {t("Bedriftssiden viser prosjektene til de ansatte og verktøyene dere bruker. Utviklere stoler mer på kollegaer enn på reklame.")}
            </Feature>
          </ul>
        </section>

        {/* Kostnad */}
        <section className="mt-20 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] glass-card p-7">
            <p className="caption">{t("Rekrutteringsbyrå")}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{t("15–25 % av årslønna")}</p>
            <p className="mt-2 text-mist">
              {t("For én utvikler med {salary} i lønn er det {low}–{high}, for én ansettelse.", {
                salary: money(locale, SALARY),
                low: money(locale, agency[0]),
                high: money(locale, agency[1]),
              })}
            </p>
          </div>
          <div className="rounded-[28px] bg-primary/10 p-7 ring-2 ring-sea/40">
            <p className="caption">Vis {t("Bedrift")}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{t("{price} i måneden", { price: money(locale, monthly) })}</p>
            <p className="mt-2 text-mist">
              {years >= 2
                ? t("{year} i året, med ubegrenset med stillinger. Én byråansettelse koster like mye som {n} år med Vis.", { year: money(locale, yearly), n: years })
                : t("{year} i året, med ubegrenset med stillinger.", { year: money(locale, yearly) })}
            </p>
          </div>
        </section>

        {/* Priser */}
        <section id="priser" className="mt-20 scroll-mt-10">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("Priser for bedrifter")}</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col rounded-[28px] glass-card p-7">
              <p className="text-lg font-semibold">{t("Gratis")}</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">{money(locale, 0)}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
                {[t("Bedriftsside med logo og beskrivelse"), t("Én aktiv stilling om gangen"), t("Søk med Vis-profilen, med søkerliste"), t("Statistikk på visninger og søknader")].map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="text-fg/90">{f}</span>
                  </li>
                ))}
              </ul>
              <ButtonLink href={createHref} variant="secondary" className="mt-7">
                {t("Lag bedriftsside")}
              </ButtonLink>
            </div>
            <div className="flex flex-col rounded-[28px] glass-card p-7 ring-2 ring-sea/50">
              <p className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="size-5 text-ice" /> {t("Bedrift")}
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {money(locale, monthly)} <span className="text-base font-normal text-mist">{t("/mnd")}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
                {[
                  t("Ubegrenset med stillinger"),
                  t("Søkeroversikt med automatisk beskjed til kandidaten"),
                  t("Sammenligning side om side og notater"),
                  t("Kandidatsøk med lagrede søk og varsler"),
                  t("Utfordringer"),
                  t("Lister med eksport, kontakt, webhooks og API"),
                ].map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="text-fg/90">{f}</span>
                  </li>
                ))}
              </ul>
              <ButtonLink href={mine.length > 0 ? `/bedrift/${mine[0].slug}/admin?fane=abonnement` : createHref} className="mt-7">
                {t("Kom i gang")}
              </ButtonLink>
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm text-mist">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            {t("GDPR-trygt kandidatsøk: kandidatene har selv sagt ja til å bli funnet, e-posten vises bare når noen søker, og søknader slettes automatisk etter et år.")}
          </p>
        </section>

        {/* Slik fungerer det */}
        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("Slik fungerer det")}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [t("Lag bedriftssiden"), t("Logo, beskrivelse og teamet deres. Tar to minutter.")],
              [t("Legg ut en stilling eller utfordring"), t("Velg «Søk med Vis-profilen», så slipper søkerne å skrive CV på nytt.")],
              [t("Se prosjektene og flytt søkerne videre"), t("Ny → Intervju → Tilbud. Kandidaten får beskjed hver gang.")],
            ].map(([title, text], i) => (
              <li key={title} className="rounded-[22px] glass-card p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-mist">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-sm leading-6 text-mist">
            {t("Har dere stand på en karrieredag eller samarbeid med en linjeforening? Legg ut en sommerjobb eller en utfordring på Vis, og følg opp studentene dere møtte der.")}
          </p>
        </section>

        {/* Katalogen */}
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("Bedrifter på Vis")}</h2>
            <ButtonLink href="/stillinger" variant="secondary">
              {t("Ledige stillinger")}
            </ButtonLink>
          </div>
          <form action="/bedrifter" className="mt-6 max-w-md">
            <input name="q" defaultValue={q} placeholder={t("Søk etter bedrift eller sted")} aria-label={t("Søk etter bedrift")} className="h-11 w-full rounded-full bg-fill px-5 text-fg outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50" />
          </form>

          {companies.length === 0 ? (
            <EmptyState className="mt-8" icon={<Building2 className="size-5" />} title={t("Ingen bedrifter ennå")}>
              {t("Bli den første: lag en bedriftsside og legg ut en stilling gratis.")}
            </EmptyState>
          ) : (
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link href={`/bedrift/${c.slug}`} className="flex items-center gap-4 rounded-[22px] glass-card p-4 transition hover:bg-card-hover">
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fill">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.logoUrl ? <img src={c.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-5 text-mist" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{c.name}</span>
                        {c.verifiedAt && <BadgeCheck className="size-4 shrink-0 text-sea" aria-label={t("Bekreftet")} />}
                      </span>
                      <span className="block text-sm text-mist">
                        {[c.location, c.openJobs ? t(c.openJobs === 1 ? "1 ledig stilling" : "{n} ledige stillinger", { n: c.openJobs }) : null].filter(Boolean).join(" · ") ||
                          t("Ingen ledige stillinger nå")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
