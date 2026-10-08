import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ChevronRight, Download, Eye, Shield } from "lucide-react";
import { OAuthButton } from "@/components/GithubButton";
import { GithubMark } from "@/components/icons";
import { Section } from "@/components/ui/field";
import { getAccountInfo } from "@/lib/account";
import { isEmailEnabled, isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import { ApiKeys } from "@/components/developers/DeveloperTools";
import { listApiKeys } from "@/lib/api-keys";
import { getUserPlan } from "@/lib/billing";
import { countCompanyRelations } from "@/lib/company-privacy";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n";
import { getNotificationPrefs } from "@/lib/notifications";
import { getCustomDomain } from "@/lib/pro";
import { getOwnProfileFlags } from "@/lib/profiles";
import { siteHost } from "@/lib/site";
import CheckoutButton from "@/app/priser/CheckoutButton";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import EditNav from "../EditNav";
import { ProSettings, VisitPrivacy } from "./ProSettings";
import TwoFactorSettings from "./TwoFactorSettings";
import { ChangePassword, DeleteAccount, EmailStatus, NotificationSettings, OtherSessions } from "./AccountForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: makeT(await getLocale())("Konto og varsler"), robots: { index: false } };
}

export default async function AccountPage() {
  const user = await requireUser();
  const [info, prefs, plan, flags, domain, keys, relations] = await Promise.all([
    getAccountInfo(user.id),
    getNotificationPrefs(user.id),
    getUserPlan(user.id),
    getOwnProfileFlags(user.id),
    getCustomDomain(user.id),
    listApiKeys(user.id),
    countCompanyRelations(user.id),
  ]);
  const pro = plan.plan === "pro";
  const locale = await getLocale();
  const t = makeT(locale);
  const date = (d: Date | null) => (d ? formatDate(d, locale) : "");
  if (!info) notFound();
  const devHint = !emailProviderConfigured && process.env.NODE_ENV !== "production";

  return (
    <main className="pb-28 md:pb-16 md:pl-24">
      <EditNav active="konto" username={user.username} />
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <Section id="abonnement" title={t("Abonnement")} description={t("Vis er gratis. Pro gir mer innsikt, eget domene og flere CV-maler.")}>
          <div className="max-w-lg rounded-[18px] glass-card p-5">
            <p className="text-lg font-semibold">{pro ? "Pro" : t("Gratis")}</p>
            {plan.source === "stripe" && (
              <p className="mt-1 text-sm text-mist">
                {plan.cancelAtPeriodEnd ? t("Avsluttes {date}.", { date: date(plan.renewsAt) }) : t("Fornyes {date}", { date: date(plan.renewsAt) })}
                {plan.interval === "year" ? ` (${t("årlig")})` : plan.interval === "month" ? ` (${t("månedlig")})` : ""}
                {plan.status === "past_due" && <span className="block text-warn">{t("Betalingen feilet. Oppdater kortet for å beholde Pro.")}</span>}
              </p>
            )}
            {plan.source === "grant" && (
              <p className="mt-1 text-sm text-mist">{plan.grantUntil ? t("Gitt av Vis til {date}.", { date: date(plan.grantUntil) }) : t("Gitt av Vis.")}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {plan.source === "stripe" ? (
                <CheckoutButton portal variant="secondary">
                  {t("Administrer betaling og kvitteringer")}
                </CheckoutButton>
              ) : !pro ? (
                <ButtonLink href="/priser" size="sm">
                  {t("Se Pro")}
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </Section>

        <Section id="pro" title={t("Pro-innstillinger")} description={t("Eget domene og Vis-merket.")}>
          <ProSettings
            isPro={pro}
            hideBranding={flags.hideBranding}
            appHost={siteHost()}
            domain={domain ? { domain: domain.domain, token: domain.token, verified: Boolean(domain.verifiedAt) } : null}
          />
        </Section>

        <Section id="personvern" title={t("Personvern")} description={t("Hva andre ser når du er innom profilene deres.")}>
          <VisitPrivacy initial={{ hideVisits: flags.hideVisits }} />
        </Section>

        <Section id="bedrifter" title={t("Bedrifter og deg")} description={t("Bedrifter som har lagret deg, kontaktet deg eller fått en søknad fra deg.")}>
          <Link href="/profil/rediger/konto/bedrifter" className="group flex max-w-lg items-center gap-4 rounded-[18px] glass-card p-4 transition-colors hover:bg-fill">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-sea/15 text-sea">
              <Building2 className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t("Se bedriftene, fjern deg fra listene eller blokker")}</span>
              <span className="mt-0.5 block text-xs text-mist">
                {[
                  relations.saved ? t("{n} har lagret deg nå", { n: relations.saved }) : t("Ingen har lagret deg nå"),
                  relations.blocked ? t("{n} blokkert", { n: relations.blocked }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-mist transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Section>

        <Section title={t("E-post")} description={t("Brukes til innlogging og beskjeder. Den vises aldri for andre.")}>
          <EmailStatus email={info.email} verified={info.emailVerified} canSend={isEmailEnabled} devHint={devHint} />
        </Section>

        <Section id="varsler" title={t("E-postvarsler")} description={t("Velg hva du vil få e-post om.")}>
          <NotificationSettings initial={prefs} emailEnabled={emailProviderConfigured || process.env.NODE_ENV !== "production"} inCompany={relations.memberOf > 0} />
        </Section>

        {info.hasPassword && (
          <Section title={t("Passord")} description={t("Når du bytter passord, logges du ut på alle andre enheter.")}>
            <ChangePassword />
          </Section>
        )}

        <Section id="to-trinn" title={t("To-trinns innlogging")} description={t("Et ekstra lag med sikkerhet: en kode fra telefonen i tillegg til passordet.")}>
          <TwoFactorSettings enabled={Boolean(info.twoFactorEnabled)} hasPassword={info.hasPassword} />
        </Section>

        <Section title={t("Innlogginger")} description={t("Har du logget inn på en maskin du ikke bruker lenger, kan du logge ut der herfra.")}>
          <OtherSessions count={info.sessions} />
        </Section>

        {(isGithubConfigured || isGoogleConfigured) && (
          <Section title={t("Innlogging")} description={t("Koble til GitHub for å importere repoer, eller for å logge inn uten passord.")}>
            <ul className="max-w-md space-y-3">
              {isGithubConfigured && (
                <li className="flex items-center justify-between gap-4 rounded-[18px] glass-card px-4 py-3">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <GithubMark className="size-5" /> GitHub
                  </span>
                  {info.github ? (
                    <span className="text-sm text-success">{t("Koblet til")}</span>
                  ) : (
                    <OAuthButton provider="github" mode="link" callbackURL="/profil/rediger/konto" label={t("Koble til")} />
                  )}
                </li>
              )}
              {isGoogleConfigured && (
                <li className="flex items-center justify-between gap-4 rounded-[18px] glass-card px-4 py-3">
                  <span className="text-sm font-medium">Google</span>
                  {info.google ? (
                    <span className="text-sm text-success">{t("Koblet til")}</span>
                  ) : (
                    <OAuthButton provider="google" mode="link" callbackURL="/profil/rediger/konto" label={t("Koble til")} />
                  )}
                </li>
              )}
            </ul>
          </Section>
        )}

        <Section id="utviklere" title={t("Utviklere")} description={t("Nøkler til det åpne API-et, for å vise prosjektene dine på din egen nettside.")}>
          <ApiKeys keys={keys} />
        </Section>

        <Section title={t("Dataene dine")} description={t("Du bestemmer over det du har lagt ut på Vis.")}>
          <ul className="space-y-3 text-sm">
            <li>
              <a href="/api/mine-data" className="inline-flex items-center gap-2 font-medium text-ice hover:underline">
                <Download className="size-4" /> {t("Last ned alt vi har lagret om deg")}
              </a>
              <span className="text-mist"> ({t("JSON med profil, prosjekter, CV, kommentarer og følgere")})</span>
            </li>
            <li>
              <Link href="/profil/rediger/konto/bedrifter" className="inline-flex items-center gap-2 font-medium text-ice hover:underline">
                <Building2 className="size-4" /> {t("Se hva bedrifter har lagret om deg")}
              </Link>
            </li>
            <li>
              <Link href="/profil/rediger/cv" className="inline-flex items-center gap-2 font-medium text-ice hover:underline">
                <Eye className="size-4" /> {t("Skjul eller fjern CV-dokumentet")}
              </Link>
            </li>
            <li>
              <Link href="/personvern" className="inline-flex items-center gap-2 font-medium text-ice hover:underline">
                <Shield className="size-4" /> {t("Les hvordan vi behandler personopplysninger")}
              </Link>
            </li>
          </ul>
        </Section>

        <Section title={t("Slett kontoen")} description={t("Sletter profilen, alle prosjekter og bilder, CV-en, kommentarene og følgerne dine for godt.")}>
          <DeleteAccount hasPassword={info.hasPassword} />
        </Section>
      </div>
    </main>
  );
}
