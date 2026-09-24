import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import { ButtonLink } from "@/components/ui/button";
import { emailProviderConfigured } from "@/lib/mailer";
import { getCurrentUser } from "@/lib/session";
import ResendVerification from "./ResendVerification";

export const metadata: Metadata = { title: "Bekreft e-post", robots: { index: false } };

// Eldre bekreftelseslenker sender hit. Går noe galt, kommer Better Auth hit med
// ?error=TOKEN_EXPIRED eller ?error=INVALID_TOKEN. Nye kontoer bekrefter med kode.
export default async function EmailVerifiedPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const devHint = !emailProviderConfigured && process.env.NODE_ENV !== "production";

  if (error || !user) {
    return (
      <AuthCard
        title={error === "TOKEN_EXPIRED" ? "Lenken har gått ut" : error ? "Lenken virket ikke" : "Bekreft e-posten"}
        subtitle="Skriv inn e-posten din, så sender vi en sekssifret kode du kan bekrefte med."
      >
        <ResendVerification devHint={devHint} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="E-posten er bekreftet" subtitle="Takk! Profilen din er klar.">
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/velkommen">Kom i gang</ButtonLink>
        <ButtonLink href={`/@${user.username}`} variant="secondary">
          Se profilen
        </ButtonLink>
      </div>
    </AuthCard>
  );
}
