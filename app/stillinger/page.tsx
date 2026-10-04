import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import JobList from "@/components/company/JobList";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { JOB_TYPE_LABELS, REMOTE_LABELS } from "@/lib/constants";
import { listOpenJobs } from "@/lib/jobs";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Ledige stillinger"),
    description: t("Jobber, sommerjobber og internships for utviklere, designere og andre som lager digitalt i Norden."),
  };
}

type Props = { searchParams: Promise<{ q?: string; type?: string; remote?: string }> };

export default async function JobsPage({ searchParams }: Props) {
  const { q = "", type, remote } = await searchParams;
  const t = await getT();
  const jobs = await listOpenJobs({ q: q.slice(0, 100), type: type ?? null, remote: remote ?? null });
  const chip = (href: string, label: string, active: boolean) => (
    <Link href={href} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${active ? "bg-primary text-on-primary" : "glass-chip text-fg hover:bg-fill-2"}`}>
      {label}
    </Link>
  );
  const params = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, type, remote, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/stillinger?${s}` : "/stillinger";
  };

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="caption">{t("Jobb")}</p>
            <h1 className="display mt-3 text-[clamp(2.2rem,5vw,3.6rem)]">{t("Ledige stillinger")}</h1>
          </div>
          <ButtonLink href="/bedrifter" variant="secondary">
            {t("For bedrifter")}
          </ButtonLink>
        </div>

        <form action="/stillinger" className="mt-8">
          {type && <input type="hidden" name="type" value={type} />}
          {remote && <input type="hidden" name="remote" value={remote} />}
          <input name="q" defaultValue={q} placeholder={t("Søk etter rolle, teknologi, bedrift eller sted")} aria-label={t("Søk i stillinger")} className="h-12 w-full rounded-full bg-fill px-5 text-[17px] outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50" />
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {chip(params({ type: undefined }), t("Alle typer"), !type)}
          {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => chip(params({ type: k }), t(v), type === k))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {chip(params({ remote: undefined }), t("Alle steder"), !remote)}
          {Object.entries(REMOTE_LABELS)
            .filter(([k]) => k !== "nei")
            .map(([k, v]) => chip(params({ remote: k }), t(v), remote === k))}
        </div>

        <div className="mt-8">
          {jobs.length === 0 ? (
            <EmptyState icon={<Briefcase className="size-5" />} title={t("Ingen stillinger her ennå")} action={<ButtonLink href="/bedrifter/ny">{t("Legg ut en stilling gratis")}</ButtonLink>}>
              {t("Bedrifter kan legge ut én stilling gratis.")}
            </EmptyState>
          ) : (
            <JobList jobs={jobs} />
          )}
        </div>
      </div>
    </main>
  );
}
