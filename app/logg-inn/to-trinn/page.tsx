import { Suspense } from "react";
import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import TwoFactorForm from "./TwoFactorForm";

export const metadata: Metadata = { title: "To-trinns innlogging", robots: { index: false } };

export default function TwoFactorPage() {
  return (
    <AuthCard title="Skriv inn koden" subtitle="Åpne appen du bruker til engangskoder (f.eks. Google Authenticator eller 1Password) og skriv inn koden for Vis.">
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}
