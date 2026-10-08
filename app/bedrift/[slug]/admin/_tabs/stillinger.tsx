import Link from "next/link";
import { Eye, MousePointerClick, Plus, Users } from "lucide-react";
import { JobActions } from "@/components/company/JobActions";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { countApplicationsByJob } from "@/lib/applications";
import { listCompanyJobs } from "@/lib/jobs";
import type { AdminCtx } from "./context";

export default async function StillingerTab({ ctx }: { ctx: AdminCtx }) {
  const { company, business, base, t } = ctx;
  const [jobs, applicationCounts] = await Promise.all([listCompanyJobs(company.id, { includeAll: true }), countApplicationsByJob(company.id)]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist">{business ? t("Ubegrenset med stillinger.") : t("Gratis: én aktiv stilling om gangen.")}</p>
        <ButtonLink href={`${base}/stilling/ny`} size="sm">
          <Plus className="size-4" /> {t("Ny stilling")}
        </ButtonLink>
      </div>
      {jobs.length === 0 ? (
        <EmptyState className="mt-6" title={t("Ingen stillinger ennå")}>
          {t("Legg ut den første. Den vises på bedriftssiden og under Stillinger.")}
        </EmptyState>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <Link href={`${base}/stilling/${j.id}`} className="font-semibold hover:text-ice">
                  {j.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-mist">
                  <span className={j.status === "published" ? "text-success" : j.status === "draft" ? "text-warn" : ""}>
                    {j.status === "published" ? t("Publisert") : j.status === "draft" ? t("Utkast") : t("Lukket")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3.5" /> {t("{n} visninger", { n: j.views })}
                  </span>
                  {j.applyMode === "vis" ? (
                    <Link href={`${base}?fane=sokere&stilling=${j.id}`} className="inline-flex items-center gap-1 hover:text-ice">
                      <Users className="size-3.5" /> {t("{n} søkere", { n: applicationCounts.get(j.id)?.total ?? 0 })}
                      {(applicationCounts.get(j.id)?.fresh ?? 0) > 0 && <span className="text-success">({t("{n} nye", { n: applicationCounts.get(j.id)?.fresh ?? 0 })})</span>}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <MousePointerClick className="size-3.5" /> {t("{n} søknadsklikk", { n: j.applyClicks })}
                    </span>
                  )}
                </p>
              </div>
              <JobActions jobId={j.id} status={j.status} fresh={applicationCounts.get(j.id)?.fresh ?? 0} business={business} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
