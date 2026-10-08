import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Building2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { listMyApplications } from "@/lib/applications";
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { dateLocale, makeT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLocale());
  return { title: t("Søknadene dine"), robots: { index: false } };
}

const TONE = {
  ny: "bg-fill text-mist",
  intervju: "tone tone-ice",
  tilbud: "tone tone-success",
  avslag: "bg-fill text-mist",
  trukket: "bg-fill text-mist/70",
} as const;

// Søknadene man har sendt med Vis-profilen, og hvor langt de har kommet.
export default async function MyApplicationsPage() {
  const user = await requireUser();
  const [applications, locale] = await Promise.all([listMyApplications(user.id), getLocale()]);
  const t = makeT(locale);
  const date = (d: Date) => new Date(d).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <p className="caption">{t("Jobb")}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{t("Søknadene dine")}</h1>
        <p className="mt-3 text-mist">{t("Du får varsel og e-post når en bedrift flytter søknaden din videre.")}</p>

        {applications.length === 0 ? (
          <EmptyState className="mt-10" icon={<Briefcase className="size-5" />} title={t("Ingen søknader ennå")}>
            {t("Stillinger med «Søk med Vis-profilen» kan du søke på med ett klikk.")}
            <div className="mt-5">
              <ButtonLink href="/stillinger" size="sm">
                {t("Se ledige stillinger")}
              </ButtonLink>
            </div>
          </EmptyState>
        ) : (
          <ul className="mt-8 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {applications.map((a) => {
              const step = APPLICATION_STAGES.indexOf(a.status as (typeof APPLICATION_STAGES)[number]);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fill">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {a.company.logoUrl ? <img src={a.company.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-5 text-mist" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/stillinger/${a.job.id}`} className="font-semibold hover:text-ice">
                      {a.job.title}
                    </Link>
                    <p className="text-sm text-mist">
                      <Link href={`/bedrift/${a.company.slug}`} className="hover:text-fg">
                        {a.company.name}
                      </Link>{" "}
                      · {t("søkte {date}", { date: date(a.createdAt) })}
                      {a.status !== "ny" && ` · ${t("oppdatert {date}", { date: date(a.statusChangedAt) })}`}
                    </p>
                    {/* Fremdrift: Ny → Intervju → Tilbud */}
                    {a.status !== "avslag" && a.status !== "trukket" && (
                      <ol className="mt-2 flex items-center gap-1.5" aria-label={t("Fremdrift")}>
                        {APPLICATION_STAGES.slice(0, 3).map((s, i) => (
                          <li key={s} className={`h-1.5 w-10 rounded-full ${i <= step ? "bg-sea" : "bg-fill-2"}`} title={t(APPLICATION_STATUS_LABELS[s])} />
                        ))}
                      </ol>
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[a.status]}`}>{t(APPLICATION_STATUS_LABELS[a.status])}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
