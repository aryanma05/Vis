import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { listCompanies, listMyCompanies } from "@/lib/companies";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Bedrifter"), description: t("Bedrifter på Vis som ser etter utviklere, designere og andre som lager digitalt.") };
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const [companies, mine] = await Promise.all([listCompanies({ q }), user ? listMyCompanies(user.id) : []]);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="caption">{t("For arbeidsgivere")}</p>
            <h1 className="display mt-3 text-[clamp(2.2rem,5vw,3.6rem)]">{t("Bedrifter")}</h1>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/stillinger" variant="secondary">
              {t("Ledige stillinger")}
            </ButtonLink>
            <ButtonLink href={user ? "/bedrifter/ny" : "/register?neste=/bedrifter/ny"}>
              <Plus className="size-4" /> {t("Lag bedriftsside")}
            </ButtonLink>
          </div>
        </div>

        {mine.length > 0 && (
          <section className="mt-10">
            <h2 className="caption">{t("Dine bedrifter")}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link href={`/bedrift/${c.slug}/admin`} className="inline-flex items-center gap-2 rounded-full glass-chip px-4 py-2 text-sm font-medium hover:bg-fill-2">
                    {c.name} <span className="text-mist">· {t("administrer")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form action="/bedrifter" className="mt-10 max-w-md">
          <input name="q" defaultValue={q} placeholder={t("Søk etter bedrift eller sted")} aria-label={t("Søk etter bedrift")} className="h-11 w-full rounded-full bg-fill px-5 text-fg outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50" />
        </form>

        {companies.length === 0 ? (
          <EmptyState className="mt-10" icon={<Building2 className="size-5" />} title={t("Ingen bedrifter ennå")}>
            {t("Bli den første: lag en bedriftsside og legg ut en stilling gratis.")}
          </EmptyState>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <li key={c.id}>
                <Link href={`/bedrift/${c.slug}`} className="flex items-center gap-4 rounded-[22px] glass-card p-4 transition hover:bg-card-hover">
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fill">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.logoUrl ? <img src={c.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-5 text-mist" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="truncate">{c.name}</span>
                      {c.verifiedAt && <BadgeCheck className="size-4 shrink-0 text-sea" aria-label={t("Bekreftet")} />}
                    </span>
                    <span className="block text-sm text-mist">
                      {[c.location, c.openJobs ? t(c.openJobs === 1 ? "1 ledig stilling" : "{n} ledige stillinger", { n: c.openJobs }) : null].filter(Boolean).join(" · ") || t("Ingen ledige stillinger nå")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
