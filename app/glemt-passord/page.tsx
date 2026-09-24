import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { isEmailEnabled } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Glemt passord", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Glemt passordet?" subtitle="Ingen fare. Vi sender en kode til e-posten din, så lager du et nytt.">
      {isEmailEnabled ? (
        <ForgotPasswordForm devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} />
      ) : (
        <p className="text-mist">
          Nytt passord er ikke satt opp ennå (e-post mangler på serveren). Logger du inn med GitHub eller Google, trenger du
          ikke passord.
        </p>
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
