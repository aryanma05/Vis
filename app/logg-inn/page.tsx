import { Suspense } from "react";
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
import LoginForm from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Logg inn"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ neste?: string }> }) {
  const [user, { neste }, t] = await Promise.all([getCurrentUser(), searchParams, getT()]);
  const next = safeInternalPath(neste);
  if (user) redirect(next ?? `/@${user.username}`);

  return (
    <AuthCard title={t("Velkommen tilbake")} subtitle={t("Logg inn for å dele prosjekter, følge folk og kommentere.")}>
      <SocialLogins github={isGithubConfigured} google={isGoogleConfigured} callbackURL={next ?? "/"} />
      <Suspense>
        <LoginForm devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} />
      </Suspense>
      <p className="mt-8 text-center text-sm text-mist">
        {t("Ny på Vis?")}{" "}
        <Link href={next ? `/register?neste=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-fg underline-offset-4 hover:underline">
          {t("Lag en profil")}
        </Link>
      </p>
    </AuthCard>
  );
}
