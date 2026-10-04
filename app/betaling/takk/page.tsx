import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { confirmCheckout } from "@/lib/billing";
import { getCompanyById } from "@/lib/companies";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Takk!", robots: { index: false } };

// Stripe sender hit etter betaling. Abonnementet hentes med en gang, så det er aktivt
// selv om webhooken ikke har kommet ennå.
export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const user = await requireUser();
  const { session_id } = await searchParams;
  const result = session_id ? await confirmCheckout(session_id, user.id) : null;
  const company = result?.ownerType === "company" ? await getCompanyById(result.ownerId) : null;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-24 md:pl-24">
      <div className="max-w-md rounded-[28px] glass-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{company ? `Bedrift er aktivert for ${company.name}` : "Velkommen til Pro!"}</h1>
        <p className="mt-3 text-mist">
          {result
            ? "Takk for at du støtter Vis. Kvitteringen kommer på e-post fra Stripe."
            : "Takk! Betalingen behandles. Det kan ta et minutt før alt er aktivert."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {company ? (
            <ButtonLink href={`/bedrift/${company.slug}/admin`}>Til bedriftssiden</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/innsikt">Se hvem som har besøkt deg</ButtonLink>
              <ButtonLink href="/profil/rediger/konto#pro" variant="secondary">
                Pro-innstillinger
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
