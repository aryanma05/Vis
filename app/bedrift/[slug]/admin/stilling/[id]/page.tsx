import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import JobForm from "@/components/company/JobForm";
import { getCompanyBySlug, getMembership } from "@/lib/companies";
import { getT } from "@/lib/i18n/server";
import { getJob } from "@/lib/jobs";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Stilling"), robots: { index: false } };
}

export default async function EditJobPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const user = await requireUser();
  const [{ slug, id }, t] = await Promise.all([params, getT()]);
  const company = await getCompanyBySlug(slug);
  if (!company || !(await getMembership(user.id, company.id))) notFound();
  const job = id === "ny" ? null : await getJob(id, { asMember: true });
  if (id !== "ny" && (!job || job.companyId !== company.id)) notFound();
  const adminPath = `/bedrift/${company.slug}/admin?fane=stillinger`;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <Link href={adminPath} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Stillinger")}
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{job ? t("Rediger stilling") : t("Ny stilling")}</h1>
        <p className="mt-2 text-mist">{company.name}</p>
        <div className="mt-8">
          <JobForm
            companyId={company.id}
            jobId={job?.id}
            adminPath={adminPath}
            initial={{
              title: job?.title ?? "",
              description: job?.description ?? "",
              location: job?.location ?? company.location ?? "",
              remote: job?.remote ?? "nei",
              type: job?.type ?? "fulltid",
              applyUrl: job?.applyUrl ?? "",
              applyEmail: job?.applyEmail ?? "",
              deadline: job?.deadline ?? "",
              tags: job?.tags ?? [],
              // Nye stillinger bruker «Søk med Vis-profilen»; eksisterende beholder det de har.
              applyMode: job ? (job.applyMode === "vis" ? "vis" : "ekstern") : "vis",
            }}
          />
        </div>
      </div>
    </main>
  );
}
