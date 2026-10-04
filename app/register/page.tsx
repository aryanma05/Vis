import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { SocialLogins } from "@/components/GithubButton";
import { isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import RegisterForm from "./RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Lag profil"), description: t("Lag en gratis profil på Vis: visittkort, CV og prosjekter samlet på én lenke.") };
}

export default async function RegisterPage() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  if (user) redirect(`/@${user.username}`);

  return (
    <AuthCard
      title={t("Lag profilen din")}
      subtitle={t("Ett sted for alt du har laget, og én lenke å dele. Gratis.")}
    >
      <SocialLogins github={isGithubConfigured} google={isGoogleConfigured} callbackURL="/velkommen" />
      <RegisterForm devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} />
      <p className="mt-6 text-center text-sm text-mist">
        {t("Har du allerede en profil?")}{" "}
        <Link href="/logg-inn" className="font-semibold text-fg underline-offset-4 hover:underline">
          {t("Logg inn")}
        </Link>
      </p>
    </AuthCard>
  );
}
