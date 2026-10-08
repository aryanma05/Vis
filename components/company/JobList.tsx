import Link from "next/link";
import { BadgeCheck, Building2 } from "lucide-react";
import { JOB_TYPE_LABELS, REMOTE_LABELS } from "@/lib/constants";
import { dateLocale, makeT, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

type JobRow = {
  id: string;
  title: string;
  location: string | null;
  remote: string;
  type: string;
  deadline: string | null;
  tags: string[];
  applyMode?: string;
  publishedAt: Date | null;
  company: { slug: string; name: string; logoUrl: string | null; verifiedAt: Date | null };
};

const deadlineLabel = (d: string | null, locale: Locale) => {
  const t = makeT(locale);
  if (!d) return t("Løpende");
  return t("Frist {date}", { date: new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "short" }) });
};

// Liste over stillinger (stillingssiden og bedriftssiden).
export default async function JobList({ jobs, showCompany = true }: { jobs: JobRow[]; showCompany?: boolean }) {
  const locale = await getLocale();
  const t = makeT(locale);
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
      {jobs.map((j) => (
        <li key={j.id}>
          <Link href={`/stillinger/${j.id}`} className="flex gap-4 px-5 py-4 transition hover:bg-fill">
            {showCompany && (
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fill">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {j.company.logoUrl ? <img src={j.company.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-5 text-mist" />}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{j.title}</span>
              <span className="mt-0.5 block text-sm text-mist">
                {showCompany && (
                  <span className="inline-flex items-center gap-1 text-fg/85">
                    {j.company.name}
                    {j.company.verifiedAt && <BadgeCheck className="size-3.5 text-sea" aria-label={t("Bekreftet")} />}
                    <span className="text-mist"> · </span>
                  </span>
                )}
                {[t(JOB_TYPE_LABELS[j.type as keyof typeof JOB_TYPE_LABELS] ?? ""), j.location, j.remote !== "nei" ? t(REMOTE_LABELS[j.remote as keyof typeof REMOTE_LABELS] ?? "") : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {j.tags.length > 0 && (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {j.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-full bg-fill px-2 py-0.5 text-xs text-mist">
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1.5 text-xs text-mist">
              {deadlineLabel(j.deadline, locale)}
              {j.applyMode === "vis" && <span className="rounded-full bg-sea/15 px-2 py-0.5 font-medium text-ice">{t("Søk med Vis")}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
