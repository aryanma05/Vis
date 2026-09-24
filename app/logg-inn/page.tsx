import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { SocialLogins } from "@/components/GithubButton";
import { isEmailEnabled, isGithubConfigured, isGoogleConfigured } from "@/lib/auth";
import { emailProviderConfigured } from "@/lib/mailer";
import { getCurrentUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Logg inn", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ neste?: string }> }) {
  const [user, { neste }] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(neste?.startsWith("/") && !neste.startsWith("//") ? neste : `/@${user.username}`);

  return (
    <AuthCard title="Velkommen tilbake" subtitle="Logg inn for å dele prosjekter, følge folk og kommentere.">
      <SocialLogins github={isGithubConfigured} google={isGoogleConfigured} callbackURL={neste ?? "/"} />
      <Suspense>
        <LoginForm canResetPassword={isEmailEnabled} devHint={!emailProviderConfigured && process.env.NODE_ENV !== "production"} />
      </Suspense>
      <p className="mt-8 text-center text-sm text-mist">
        Ny på Vis?{" "}
        <Link href="/register" className="font-semibold text-fg underline-offset-4 hover:underline">
          Lag en profil
        </Link>
      </p>
    </AuthCard>
  );
}
