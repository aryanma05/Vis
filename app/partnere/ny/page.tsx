import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PartnerPostForm from "@/components/partners/PartnerPostForm";
import { COMMITMENTS } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { listOwnProjectsForPicker } from "@/lib/partner-posts";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Legg ut et prosjekt"), robots: { index: false } };
}

// Legg ut en idé eller et påbegynt prosjekt som trenger folk. ?prosjekt=<id> kommer fra
// prosjektsiden og velger prosjektet på forhånd.
export default async function NewPartnerPostPage({ searchParams }: { searchParams: Promise<{ prosjekt?: string }> }) {
  const user = await requireUser();
  const [{ prosjekt }, projects, t] = await Promise.all([searchParams, listOwnProjectsForPicker(user.id), getT()]);
  const linked = projects.find((p) => p.id === prosjekt);

  return (
    <main className="px-5 pb-28 pt-8 md:pb-16 md:pl-28 md:pr-10 md:pt-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/partnere" className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Samarbeid")}
        </Link>
        <h1 className="mt-4 display text-[34px] md:text-5xl">{t("Legg ut et prosjekt")}</h1>
        <p className="mt-3 text-lg text-mist">
          {t("Fortell hva du vil lage og hva du trenger hjelp med. Folk kan tilby seg å bli med fra start til slutt, på en del av det, eller bare for gøy.")}
        </p>
        <div className="mt-8 rounded-[26px] glass-card p-6 md:p-8">
          <PartnerPostForm
            projects={projects}
            initial={{
              title: linked?.title ?? "",
              description: "",
              stage: linked ? "pabegynt" : "ide",
              projectId: linked?.id ?? "",
              needs: [],
              commitments: [...COMMITMENTS],
            }}
          />
        </div>
      </div>
    </main>
  );
}
