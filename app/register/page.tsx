import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard, { AuthArt } from "@/components/AuthCard";
import { SocialLogins } from "@/components/GithubButton";
import { isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import { getCurrentUser } from "@/lib/session";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Lag profil",
  description: "Lag en gratis profil på Vis: visittkort, CV og prosjekter samlet på én lenke.",
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(`/@${user.username}`);

  return (
    <AuthCard
      title={
        <>
          Lag profilen din <span className="serif-accent font-normal text-ice">på to minutter</span>
        </>
      }
      subtitle="Én lenke med visittkort, CV og alt du har laget. Gratis."
      aside={
        <AuthArt
          quote={
            <>
              «Endelig et sted der prosjektene mine <span className="serif-accent text-ice">faktisk</span> blir sett.»
            </>
          }
        />
      }
    >
      <SocialLogins github={isGithubConfigured} google={isGoogleConfigured} callbackURL="/velkommen" />
      <RegisterForm devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} />
      <p className="mt-8 text-center text-sm text-mist">
        Har du allerede en profil?{" "}
        <Link href="/logg-inn" className="font-semibold text-fg underline-offset-4 hover:underline">
          Logg inn
        </Link>
      </p>
    </AuthCard>
  );
}
