import { Suspense } from "react";
import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import { getT } from "@/lib/i18n/server";
import TwoFactorForm from "./TwoFactorForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("To-trinns innlogging"), robots: { index: false } };
}

export default async function TwoFactorPage() {
  const t = await getT();
  return (
    <AuthCard
      title={t("Skriv inn koden")}
      subtitle={t("Åpne appen du bruker til engangskoder (f.eks. Google Authenticator eller 1Password) og skriv inn koden for Vis.")}
    >
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}
