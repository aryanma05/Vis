import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { SocialLogins } from "@/components/GithubButton";
import { isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import { safeInternalPath } from "@/lib/safe-path";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import RegisterForm from "./RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Lag profil"), description: t("Lag en gratis profil på Vis: visittkort, CV og prosjekter samlet på én lenke.") };
}

// ?neste=: hvor man sendes etter at kontoen er laget (f.eks. en invitasjon). Bare interne stier.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ neste?: string }> }) {
  const [user, { neste }, t] = await Promise.all([getCurrentUser(), searchParams, getT()]);
  const next = safeInternalPath(neste);
  if (user) redirect(next ?? `/@${user.username}`);

  return (
    <AuthCard
      title={t("Lag profilen din")}
      subtitle={t("Ett sted for alt du har laget, og én lenke å dele. Gratis.")}
    >
      <SocialLogins github={isGithubConfigured} google={isGoogleConfigured} callbackURL={next ?? "/velkommen"} />
      <RegisterForm devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} next={next} />
      <p className="mt-6 text-center text-sm text-mist">
        {t("Har du allerede en profil?")}{" "}
        <Link href={next ? `/logg-inn?neste=${encodeURIComponent(next)}` : "/logg-inn"} className="font-semibold text-fg underline-offset-4 hover:underline">
          {t("Logg inn")}
        </Link>
      </p>
    </AuthCard>
  );
}
