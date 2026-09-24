import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { getCurrentUser } from "@/lib/session";
import ResendVerification from "./ResendVerification";

export const metadata = { title: "E-post bekreftet – vis" };

// Lenken i bekreftelses-e-posten sender hit. Går noe galt, kommer Better Auth hit med
// ?error=TOKEN_EXPIRED eller ?error=INVALID_TOKEN.
export default async function EmailVerifiedPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getCurrentUser();

  if (error) {
    return (
      <AuthCard title={error === "TOKEN_EXPIRED" ? "Lenken har gått ut" : "Lenken virket ikke"}>
        <p className="mt-4 text-mist">
          {error === "TOKEN_EXPIRED"
            ? "Bekreftelseslenker virker i 24 timer."
            : "Lenken er ugyldig eller allerede brukt."}{" "}
          Skriv inn e-posten din, så sender vi en ny.
        </p>
        <ResendVerification />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="E-posten er bekreftet">
      <p className="mt-4 text-mist">Takk! Kontoen din er klar.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {user ? (
          <>
            <Link href="/ny" className="rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary transition hover:opacity-90">
              Del ditt første prosjekt
            </Link>
            <Link href="/profil/rediger" className="rounded-lg border border-line px-5 py-3 font-semibold text-fg transition hover:border-ice">
              Fyll ut profilen
            </Link>
          </>
        ) : (
          <Link href="/logg-inn" className="rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary transition hover:opacity-90">
            Logg inn
          </Link>
        )}
      </div>
    </AuthCard>
  );
}
