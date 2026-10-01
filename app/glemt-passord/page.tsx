import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { SocialLogins } from "@/components/GithubButton";
import { isEmailEnabled, isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Glemt passord", robots: { index: false } };

export default function ForgotPasswordPage() {
  const contact = process.env.CONTACT_EMAIL?.trim();

  return (
    <AuthCard title="Glemt passordet?" subtitle="Ingen fare. Vi sender en kode til e-posten din, så lager du et nytt.">
      {isEmailEnabled ? (
        <ForgotPasswordForm devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} />
      ) : (
        // Serveren kan ikke sende e-post (BREVO_API_KEY/RESEND_API_KEY og EMAIL_FROM mangler, se README).
        <div className="space-y-5 text-mist">
          <p className="leading-7">
            Vi kan ikke sende koder på e-post akkurat nå, så nytt passord må lages med hjelp fra oss.
            {contact ? (
              <>
                {" "}
                Skriv til{" "}
                <a href={`mailto:${contact}?subject=${encodeURIComponent("Nytt passord på Vis")}`} className="font-medium text-ice underline-offset-4 hover:underline">
                  {contact}
                </a>{" "}
                fra e-posten du registrerte deg med, så hjelper vi deg.
              </>
            ) : (
              " Ta kontakt med oss fra e-posten du registrerte deg med, så hjelper vi deg."
            )}
          </p>
          {(isGithubConfigured || isGoogleConfigured) && (
            <>
              <p className="text-sm">Bruker kontoen samme e-post som GitHub eller Google, kan du prøve å logge inn med dem i stedet:</p>
              <SocialLogins github={isGithubConfigured} google={isGoogleConfigured} callbackURL="/" divider="eller" />
            </>
          )}
        </div>
      )}
      <p className="mt-8 text-center text-sm text-mist">
        Kom du på det?{" "}
        <Link href="/logg-inn" className="font-semibold text-fg underline-offset-4 hover:underline">
          Logg inn
        </Link>
      </p>
    </AuthCard>
  );
}
