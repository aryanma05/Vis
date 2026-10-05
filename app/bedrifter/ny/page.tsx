import type { Metadata } from "next";
import CompanyForm from "@/components/company/CompanyForm";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Lag bedriftsside", robots: { index: false } };

export default async function NewCompanyPage() {
  await requireUser();
  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-2xl">
        <p className="caption">Ny bedrift</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Lag en bedriftsside</h1>
        <p className="mt-3 text-mist">
          Gratis, med én aktiv stilling om gangen. Med Bedrift-abonnementet får dere ubegrenset med stillinger, kandidatsøk og lister.
        </p>
        <div className="mt-8">
          <CompanyForm />
        </div>
      </div>
    </main>
  );
}
