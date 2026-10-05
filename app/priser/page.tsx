import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Check, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getDisplayPrices, getUserPlan } from "@/lib/billing";
import { listMyCompanies } from "@/lib/companies";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/server";
import { makeT, type Locale, type T } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";
import CheckoutButton from "./CheckoutButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLocale());
  return {
    title: t("Priser"),
    description: t("Vis er gratis for alle. Pro gir deg mer innsikt og eget domene, Bedrift gir stillingsannonser og kandidatsøk."),
  };
}

const money = (locale: Locale) => (amount: number) =>
  locale === "en" ? `NOK ${amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : `${amount.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr`;

const FREE = [
  "Profil, portefølje og ubegrenset med prosjekter",
  "CV i tre maler, last ned som PDF",
  "Hent prosjekter fra GitHub, eller lim inn en lenke for skjermbilder",
  "Fyll ut CV-en fra PDF eller Word",
  "Del med QR-kode, README-merke og innbygging",
  "Innsikt for de siste 30 dagene",
];
const PRO = [
  "Se hvem som har sett profilen din",
  "Innsikt for opptil 12 måneder",
  "To ekstra CV-maler: Elegant og Tydelig",
  "Eget domene (dittnavn.no)",
  "Uten «Laget med Vis» på CV-en og innbyggingskortene",
  "Pro-merke på profilen",
];
const BUSINESS = [
  "Bedriftsside med logo og stillinger",
  "Ubegrenset med stillingsannonser (gratis: én om gangen)",
  "Kandidatsøk blant folk som er synlige for bedrifter",
  "Kandidatlister med notater og eksport til Excel",
  "Ta kontakt med kandidater direkte",
  "Statistikk på visninger og søknadsklikk",
  "Opptil 25 medlemmer, webhooks og API",
];

function Features({ items, t }: { items: string[]; t: T }) {
  return (
    <ul className="mt-6 space-y-2.5 text-[15px]">
      {items.map((f) => (
        <li key={f} className="flex gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <span className="text-fg/90">{t(f)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ avbrutt?: string }> }) {
  const [{ avbrutt }, user, prices, locale] = await Promise.all([searchParams, getCurrentUser(), getDisplayPrices(), getLocale()]);
  const t = makeT(locale);
  const kr = money(locale);
  const [plan, companies] = user ? await Promise.all([getUserPlan(user.id), listMyCompanies(user.id)]) : [null, []];
  const ownCompanies = companies.filter((c) => c.role === "owner" || c.role === "admin");
  const yearlySaving = Math.round(100 - (prices["pro:year"].amount / (prices["pro:month"].amount * 12)) * 100);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-16">
      <div className="mx-auto max-w-6xl">
        <p className="caption">{t("Priser")}</p>
        <h1 className="display mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4rem)]">{t("Gratis for alle. Mer for dem som vil ha det.")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-mist">
          {t("Alt du trenger for å vise frem det du lager er gratis, og blir det. Pro og Bedrift betaler for driften.")}
        </p>
        {avbrutt && <p className="mt-6 rounded-2xl bg-fill px-4 py-3 text-sm text-mist">{t("Betalingen ble avbrutt. Ingenting er trukket.")}</p>}

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="flex flex-col rounded-[28px] glass-card p-7">
            <h2 className="text-xl font-semibold">{t("Gratis")}</h2>
            <p className="mt-3 text-4xl font-bold tracking-tight">{t("0 kr")}</p>
            <p className="mt-1 text-sm text-mist">{t("For alltid")}</p>
            <Features items={FREE} t={t} />
            <div className="mt-auto pt-8">
              {user ? (
                <p className="text-sm text-mist">{t(plan?.plan === "pro" ? "Alt i Gratis er med i Pro." : "Dette har du nå.")}</p>
              ) : (
                <ButtonLink href="/register" variant="secondary" className="w-full">
                  {t("Lag profil")}
                </ButtonLink>
              )}
            </div>
          </section>

          <section className="relative flex flex-col rounded-[28px] glass-card p-7 ring-2 ring-sea/60">
            <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-sea px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="size-3.5" /> {t("Mest valgt")}
            </span>
            <h2 className="text-xl font-semibold">Pro</h2>
            <p className="mt-3 text-4xl font-bold tracking-tight">
              {kr(prices["pro:month"].amount)}
              <span className="text-base font-medium text-mist"> {t("/ mnd")}</span>
            </p>
            <p className="mt-1 text-sm text-mist">
              {t("eller {price} i året", { price: kr(prices["pro:year"].amount) })}
              {yearlySaving > 0 ? ` ${t("(spar {n} %)", { n: yearlySaving })}` : ""}
            </p>
            <Features items={PRO} t={t} />
            <div className="mt-auto space-y-2 pt-8">
              {!user ? (
                <ButtonLink href="/register?neste=/priser" className="w-full">
                  {t("Lag profil og få Pro")}
                </ButtonLink>
              ) : plan?.plan === "pro" ? (
                plan.source === "stripe" ? (
                  <CheckoutButton portal variant="secondary" className="w-full">
                    {t("Administrer abonnementet")}
                  </CheckoutButton>
                ) : (
                  <p className="text-sm text-success">
                    {plan.grantUntil ? t("Du har Pro til {date}.", { date: formatDate(plan.grantUntil, locale) }) : t("Du har Pro.")}
                  </p>
                )
              ) : (
                <>
                  <CheckoutButton plan="pro" interval="month" className="w-full">
                    {t("Få Pro – {price} / mnd", { price: kr(prices["pro:month"].amount) })}
                  </CheckoutButton>
                  <CheckoutButton plan="pro" interval="year" variant="secondary" className="w-full">
                    {t("Betal for et år – {price}", { price: kr(prices["pro:year"].amount) })}
                  </CheckoutButton>
                </>
              )}
            </div>
          </section>

          <section className="flex flex-col rounded-[28px] glass-card p-7">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Building2 className="size-5 text-mist" /> {t("Bedrift")}
            </h2>
            <p className="mt-3 text-4xl font-bold tracking-tight">
              {kr(prices["business:month"].amount)}
              <span className="text-base font-medium text-mist"> {t("/ mnd")}</span>
            </p>
            <p className="mt-1 text-sm text-mist">{t("Per bedrift, eks. mva. Ingen bindingstid.")}</p>
            <Features items={BUSINESS} t={t} />
            <div className="mt-auto space-y-2 pt-8">
              {ownCompanies.length > 0 ? (
                ownCompanies.map((c) => (
                  <ButtonLink key={c.id} href={`/bedrift/${c.slug}/admin?fane=abonnement`} variant="secondary" className="w-full">
                    {t("Bedrift for {name}", { name: c.name })}
                  </ButtonLink>
                ))
              ) : (
                <ButtonLink href={user ? "/bedrifter/ny" : "/register?neste=/bedrifter/ny"} variant="secondary" className="w-full">
                  {t("Lag en bedriftsside")}
                </ButtonLink>
              )}
            </div>
          </section>
        </div>

        <section className="mt-16 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold">{t("Kan jeg si opp når som helst?")}</h2>
            <p className="mt-2 text-mist">{t("Ja. Du beholder Pro ut perioden du har betalt for, og profilen din blir aldri slettet eller skjult når du går tilbake til Gratis.")}</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("Hvordan betaler jeg?")}</h2>
            <p className="mt-2 text-mist">{t("Med kort, Apple Pay eller Google Pay gjennom Stripe. Vi ser aldri kortnummeret ditt. Kvitteringer finner du under Konto.")}</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("Er det gratis for studenter?")}</h2>
            <p className="mt-2 text-mist">
              {t("Alt i Gratis er gratis for alle. Er du student og vil ha Pro,")}{" "}
              <Link href="/om" className="text-ice hover:underline">
                {t("ta kontakt")}
              </Link>{" "}
              {t("– vi gir rabatt til skoler og linjeforeninger.")}
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("Hvem ser at jeg har sett profilen deres?")}</h2>
            <p className="mt-2 text-mist">
              {t("Bare Pro-brukere, og bare hvis du er logget inn. Du kan skjule deg under Konto; da ser du heller ikke selv hvem som har besøkt deg.")}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
