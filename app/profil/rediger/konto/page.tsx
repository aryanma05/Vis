import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, Shield } from "lucide-react";
import { OAuthButton } from "@/components/GithubButton";
import { GithubMark } from "@/components/icons";
import { Section } from "@/components/ui/field";
import { getAccountInfo } from "@/lib/account";
import { isEmailEnabled, isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import { getNotificationPrefs } from "@/lib/notifications";
import { requireUser } from "@/lib/session";
import EditNav from "../EditNav";
import { ChangePassword, DeleteAccount, EmailStatus, NotificationSettings } from "./AccountForms";

export const metadata: Metadata = { title: "Konto og varsler", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser();
  const [info, prefs] = await Promise.all([getAccountInfo(user.id), getNotificationPrefs(user.id)]);
  if (!info) notFound();
  const devHint = !emailProviderConfigured && process.env.NODE_ENV !== "production";

  return (
    <main className="pb-28 md:pb-16 md:pl-24">
      <EditNav active="konto" username={user.username} />
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <Section title="E-post" description="Brukes til innlogging og beskjeder. Den vises aldri for andre.">
          <EmailStatus email={info.email} verified={info.emailVerified} canSend={isEmailEnabled} devHint={devHint} />
        </Section>

        <Section id="varsler" title="E-postvarsler" description="Velg hva du vil få e-post om.">
          <NotificationSettings initial={prefs} emailEnabled={emailProviderConfigured || process.env.NODE_ENV !== "production"} />
        </Section>

        {info.hasPassword && (
          <Section title="Passord" description="Når du bytter passord, logges du ut på alle andre enheter.">
            <ChangePassword />
          </Section>
        )}

        {(isGithubConfigured || isGoogleConfigured) && (
          <Section title="Innlogging" description="Koble til GitHub for å importere repoer, eller for å logge inn uten passord.">
            <ul className="max-w-md space-y-3">
              {isGithubConfigured && (
                <li className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <GithubMark className="size-5" /> GitHub
                  </span>
                  {info.github ? <span className="text-sm text-success">Koblet til</span> : <OAuthButton provider="github" mode="link" callbackURL="/profil/rediger/konto" label="Koble til" />}
                </li>
              )}
              {isGoogleConfigured && (
                <li className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
                  <span className="text-sm font-medium">Google</span>
                  {info.google ? <span className="text-sm text-success">Koblet til</span> : <OAuthButton provider="google" mode="link" callbackURL="/profil/rediger/konto" label="Koble til" />}
                </li>
              )}
            </ul>
          </Section>
        )}

        <Section title="Dataene dine" description="Du bestemmer over det du har lagt ut på Vis.">
          <ul className="space-y-3 text-sm">
            <li>
              <a href="/api/mine-data" className="inline-flex items-center gap-2 font-medium text-ice hover:underline">
                <Download className="size-4" /> Last ned alt vi har lagret om deg
              </a>
              <span className="text-mist"> (JSON med profil, prosjekter, CV, kommentarer og følgere)</span>
            </li>
            <li>
              <Link href="/profil/rediger/cv" className="inline-flex items-center gap-2 font-medium text-ice hover:underline">
                <Eye className="size-4" /> Skjul eller fjern CV-dokumentet
              </Link>
            </li>
            <li>
              <Link href="/personvern" className="inline-flex items-center gap-2 font-medium text-ice hover:underline">
                <Shield className="size-4" /> Les hvordan vi behandler personopplysninger
              </Link>
            </li>
          </ul>
        </Section>

        <Section title="Slett kontoen" description="Sletter profilen, alle prosjekter og bilder, CV-en, kommentarene og følgerne dine for godt.">
          <DeleteAccount hasPassword={info.hasPassword} />
        </Section>
      </div>
    </main>
  );
}
