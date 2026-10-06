import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { SocialLogins } from "@/components/GithubButton";
import { isEmailEnabled, isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import { getT } from "@/lib/i18n/server";
import ForgotPasswordForm from "./ForgotPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Glemt passord"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  const contact = process.env.CONTACT_EMAIL?.trim();

  return (
    <AuthCard title={t("Glemt passordet?")} subtitle={t("Ingen fare. Vi sender en kode til e-posten din, så lager du et nytt.")}>
      {isEmailEnabled ? (
        <ForgotPasswordForm devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} />
      ) : (
        // Serveren kan ikke sende e-post (BREVO_API_KEY/RESEND_API_KEY og EMAIL_FROM mangler, se README).
        <div className="space-y-5 text-mist">
          <p className="leading-7">
            {t("Vi kan ikke sende koder på e-post akkurat nå, så nytt passord må lages med hjelp fra oss.")}
            {contact ? (
              <>
                {" "}
                {t("Skriv til")}{" "}
                <a href={`mailto:${contact}?subject=${encodeURIComponent(t("Nytt passord på Vis"))}`} className="font-medium text-ice underline-offset-4 hover:underline">
                  {contact}
                </a>{" "}
                {t("fra e-posten du registrerte deg med, så hjelper vi deg.")}
              </>
            ) : (
              ` ${t("Ta kontakt med oss fra e-posten du registrerte deg med, så hjelper vi deg.")}`
            )}
          </p>
          {(isGithubConfigured || isGoogleConfigured) && (
            <>
              <p className="text-sm">{t("Bruker kontoen samme e-post som GitHub eller Google, kan du prøve å logge inn med dem i stedet:")}</p>
              <SocialLogins github={isGithubConfigured} google={isGoogleConfigured} callbackURL="/" divider={t("eller")} />
            </>
          )}
        </div>
      )}
      <p className="mt-8 text-center text-sm text-mist">
        {t("Kom du på det?")}{" "}
        <Link href="/logg-inn" className="font-semibold text-fg underline-offset-4 hover:underline">
          {t("Logg inn")}
        </Link>
      </p>
    </AuthCard>
  );
}
