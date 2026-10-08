import Link from "next/link";
import { Inbox } from "lucide-react";
import { ApplicantBoard } from "@/components/company/Applicants";
import Upsell from "@/components/company/Upsell";
import { EmptyState } from "@/components/ui/misc";
import { countApplicationsByJob, listApplications } from "@/lib/applications";
import { can } from "@/lib/company-permissions";
import { listCompanyJobs } from "@/lib/jobs";
import type { AdminCtx } from "./context";

export default async function SokereTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, base, monthly, canBuy, t, query } = ctx;
  const [jobs, applicants, applicationCounts] = await Promise.all([
    listCompanyJobs(company.id, { includeAll: true }),
    listApplications(user.id, company.id, { jobId: query.stilling }),
    countApplicationsByJob(company.id),
  ]);

  return (
    <section>
      {jobs.length > 1 && (
        <nav aria-label={t("Velg stilling")} className="mb-5 flex flex-wrap gap-2">
          {[{ id: "", title: t("Alle stillinger") }, ...jobs.filter((j) => j.applyMode === "vis")].map((j) => {
            const active = (query.stilling ?? "") === j.id;
            return (
              <Link
                key={j.id || "alle"}
                href={j.id ? `${base}?fane=sokere&stilling=${j.id}` : `${base}?fane=sokere`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? "bg-primary text-on-primary" : "glass-chip hover:bg-fill-2"}`}
              >
                {j.title}
                {j.id && (applicationCounts.get(j.id)?.total ?? 0) > 0 && <span className="opacity-70"> · {applicationCounts.get(j.id)?.total}</span>}
              </Link>
            );
          })}
        </nav>
      )}
      {applicants.length === 0 ? (
        <EmptyState icon={<Inbox className="size-5" />} title={t("Ingen søkere ennå")}>
          {t("Velg «Med Vis-profilen» under «Hvordan skal folk søke?» på en stilling. Da søker folk med profilen og prosjektene sine, og alle søkerne havner her i samme format.")}
        </EmptyState>
      ) : (
        <>
          {!business && (
            <div className="mb-5">
              <Upsell companyId={company.id} price={monthly} canBuy={canBuy} t={t} feature="sokere" />
            </div>
          )}
          <ApplicantBoard
            base={base}
            canManage={business && can(role, "applications.move")}
            showJob={!query.stilling}
            applicants={applicants.map((a) => ({
              id: a.id,
              status: a.status,
              createdAt: a.createdAt,
              job: a.job,
              candidate: a.candidate,
              usedTech: a.usedTech,
              highlights: a.highlights.map((h) => ({ id: h.id, title: h.title, cover: h.cover })),
            }))}
          />
        </>
      )}
    </section>
  );
}
