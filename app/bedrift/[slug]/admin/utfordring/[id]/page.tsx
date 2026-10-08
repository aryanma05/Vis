import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ChallengeForm from "@/components/company/ChallengeForm";
import { getChallenge } from "@/lib/challenges";
import { getCompanyBySlug, getMembership } from "@/lib/companies";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Utfordring"), robots: { index: false } };
}

export default async function EditChallengePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const user = await requireUser();
  const [{ slug, id }, t] = await Promise.all([params, getT()]);
  const company = await getCompanyBySlug(slug);
  const role = company ? await getMembership(user.id, company.id) : null;
  if (!company || (role !== "owner" && role !== "admin")) notFound();
  const challenge = id === "ny" ? null : await getChallenge(id, { asMember: true });
  if (id !== "ny" && (!challenge || challenge.companyId !== company.id)) notFound();
  const adminPath = `/bedrift/${company.slug}/admin`;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <Link href={`${adminPath}?fane=utfordringer`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Utfordringer")}
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{challenge ? t("Rediger utfordring") : t("Ny utfordring")}</h1>
        <p className="mt-2 max-w-2xl text-mist">
          {t("En liten oppgave folk kan løse på en helg. Svarene blir prosjekter på Vis, så dere ser hvordan folk faktisk jobber, og de får noe å vise frem uansett.")}
        </p>
        <div className="mt-8">
          <ChallengeForm
            companyId={company.id}
            challengeId={challenge?.id}
            adminPath={adminPath}
            initial={{
              title: challenge?.title ?? "",
              description: challenge?.description ?? "",
              reward: challenge?.reward ?? "",
              deadline: challenge?.deadline ?? "",
              tags: challenge?.tags ?? [],
            }}
          />
        </div>
      </div>
    </main>
  );
}
