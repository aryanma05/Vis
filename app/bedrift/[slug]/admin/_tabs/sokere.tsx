import Link from "next/link";
import { AtSign, Clock, Inbox, ListChecks } from "lucide-react";
import { ApplicantBoard } from "@/components/company/Applicants";
import { TemplatesDialog } from "@/components/company/TemplatesDialog";
import Upsell from "@/components/company/Upsell";
import { EmptyState } from "@/components/ui/misc";
import { countApplicationsByJob, getPipelineExtras, listApplications } from "@/lib/applications";
import { can } from "@/lib/company-permissions";
import { listCompanyJobs } from "@/lib/jobs";
import { listTemplates } from "@/lib/message-templates";
import { siteUrl } from "@/lib/site";
import type { AdminCtx } from "./context";

const chip = (active: boolean) => `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? "bg-primary text-on-primary" : "glass-chip hover:bg-fill-2"}`;

export default async function SokereTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, base, monthly, canBuy, t, query } = ctx;
  const filter = query.for === "venter" || query.for === "nevninger" ? query.for : null;
  const [jobs, applicants, applicationCounts, extras, templates] = await Promise.all([
    listCompanyJobs(company.id, { includeAll: true }),
    listApplications(user.id, company.id, { jobId: query.stilling, filter }),
    countApplicationsByJob(company.id),
    getPipelineExtras(user.id, company.id),
    listTemplates(user.id, company.id),
  ]);
  const canMove = can(role, "applications.move");
  const selecting = query.velg === "1" && business && can(role, "applications.bulk");
  const visJobs = jobs.filter((j) => j.applyMode === "vis");
  const href = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ fane: "sokere" });
    for (const [k, v] of Object.entries({ stilling: query.stilling, for: filter ?? undefined, ...params })) if (v) p.set(k, v);
    return `${base}?${p}`;
  };
  const active = applicants.filter((a) => !a.withdrawn);
  const options = templates.map(({ id, kind, name, subject, body, builtIn }) => ({ id, kind, name, subject, body, builtIn }));

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("Velg stilling")} className="flex flex-wrap gap-2">
          {visJobs.length > 1 &&
            [{ id: "", title: t("Alle stillinger") }, ...visJobs].map((j) => (
              <Link key={j.id || "alle"} href={href({ stilling: j.id || "" })} aria-current={(query.stilling ?? "") === j.id ? "page" : undefined} className={chip((query.stilling ?? "") === j.id)}>
                {j.title}
                {j.id && (applicationCounts.get(j.id)?.total ?? 0) > 0 && <span className="opacity-70">· {applicationCounts.get(j.id)?.total}</span>}
              </Link>
            ))}
          <Link href={href({ for: filter === "venter" ? "" : "venter" })} className={chip(filter === "venter")}>
            <Clock className="size-3.5" /> {t("Venter > 7 d")}
            {extras.waiting > 0 && <span className="rounded-full bg-warn/15 px-1.5 text-xs text-warn">{extras.waiting}</span>}
          </Link>
          <Link href={href({ for: filter === "nevninger" ? "" : "nevninger" })} className={chip(filter === "nevninger")}>
            <AtSign className="size-3.5" /> {t("Mine nevninger")}
            {extras.mentions > 0 && <span className="rounded-full bg-sea/15 px-1.5 text-xs text-sea">{extras.mentions}</span>}
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {business && can(role, "applications.bulk") && active.length > 0 && (
            <Link href={href({ velg: selecting ? "" : "1" })} className={chip(selecting)}>
              <ListChecks className="size-3.5" /> {selecting ? t("Ferdig") : t("Velg")}
            </Link>
          )}
          <TemplatesDialog
            companyId={company.id}
            templates={options}
            business={business}
            canEdit={can(role, "templates.manage")}
            autoReply={company.autoReply}
            responseDays={company.responseDays}
            sample={{ name: "Kari Nordmann", jobTitle: visJobs[0]?.title ?? t("Stillingen"), companyName: company.name, bookingUrl: `${siteUrl()}/soknader/…/book` }}
            base={base}
          />
        </div>
      </div>

      {applicants.length === 0 ? (
        <EmptyState icon={<Inbox className="size-5" />} title={filter ? t("Ingen søkere her") : t("Ingen søkere ennå")}>
          {filter
            ? t("Ingen søkere passer filteret akkurat nå.")
            : t("Velg «Med Vis-profilen» under «Hvordan skal folk søke?» på en stilling. Da søker folk med profilen og prosjektene sine, og alle søkerne havner her i samme format.")}
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
            companyId={company.id}
            canManage={business && canMove}
            canHire={business && can(role, "applications.hire")}
            readOnly={!canMove ? "role" : !business ? "plan" : null}
            selecting={selecting}
            showJob={!query.stilling}
            templates={options}
            ctx={{ companyName: company.name, responseDays: company.responseDays, siteUrl: siteUrl(), openSlotJobs: extras.openSlotJobs }}
            withdrawn={applicants.filter((a) => a.withdrawn).map((a) => ({ id: a.id, job: a.job, candidate: { id: a.candidate.id, name: a.candidate.name, username: a.candidate.username, image: a.candidate.image } }))}
            applicants={active.map((a) => ({
              id: a.id,
              status: a.status as Exclude<typeof a.status, "trukket">,
              createdAt: a.createdAt,
              statusChangedAt: a.statusChangedAt,
              job: a.job,
              candidate: a.candidate,
              usedTech: a.usedTech,
              highlights: a.highlights.map((h) => ({ id: h.id, title: h.title, cover: h.cover })),
              noteCount: a.noteCount,
              reviewCount: a.reviewCount,
              interviewAt: a.interviewAt,
              hiredAt: a.hiredAt,
            }))}
          />
        </>
      )}
    </section>
  );
}
