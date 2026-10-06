import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Eye, Lock, Minus, ShieldCheck, Sparkles } from "lucide-react";
import Avatar from "@/components/Avatar";
import DailyBars from "@/components/insights/DailyBars";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { isPro } from "@/lib/billing";
import { timeAgo } from "@/lib/format";
import { dateLocale, type T } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { getInsights } from "@/lib/insights";
import { getProfileVisitors } from "@/lib/pro";
import { requireUser } from "@/lib/session";

const PERIODS = { "30": 30, "90": 90, "365": 365 } as const;
const PERIOD_LABEL: Record<number, string> = { 30: "30 dager", 90: "90 dager", 365: "12 måneder" };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Innsikt"), robots: { index: false } };
}

function Delta({ current, previous, days, t, nf }: { current: number; previous: number; days: number; t: T; nf: string }) {
  const diff = current - previous;
  if (previous === 0 && current === 0) return <span className="text-xs text-mist">{t("Ingen endring")}</span>;
  // Prosent sier lite når forrige periode nesten var tom (+2700 %), da vises antallet.
  const pct = previous < 20 ? null : Math.round((diff / previous) * 100);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const tone = diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-mist";
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 text-xs font-medium ${tone}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {diff > 0 ? "+" : ""}
      {pct === null ? diff.toLocaleString(nf) : `${pct.toLocaleString(nf)} %`}
      <span className="font-normal text-mist">{t("mot forrige {period}", { period: t(PERIOD_LABEL[days] ?? "30 dager") })}</span>
    </span>
  );
}

function StatTile({
  label,
  value,
  current,
  previous,
  hint,
  days,
  t,
  nf,
}: {
  label: string;
  value: number;
  current: number;
  previous: number;
  hint?: string;
  days: number;
  t: T;
  nf: string;
}) {
  return (
    <div className="rounded-[22px] glass-card p-4 sm:p-5">
      <p className="text-sm text-mist">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{value.toLocaleString(nf)}</p>
      <div className="mt-2">
        <Delta current={current} previous={previous} days={days} t={t} nf={nf} />
      </div>
      {hint && <p className="mt-2 text-xs text-mist/70">{hint}</p>}
    </div>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const user = await requireUser();
  const [{ periode }, t, locale] = await Promise.all([searchParams, getT(), getLocale()]);
  const nf = dateLocale(locale);
  const pro = await isPro(user.id);
  const requested = PERIODS[periode as keyof typeof PERIODS] ?? 30;
  const days = pro ? requested : 30;
  const [data, visitors] = await Promise.all([getInsights(user.id, days), getProfileVisitors(user.id, days)]);
  const maxViews = Math.max(...data.topProjects.map((p) => p.views30), 1);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="caption">{t("Siste {period}", { period: t(PERIOD_LABEL[days]) })}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{t("Innsikt")}</h1>
          </div>
          <ButtonLink href={`/@${user.username}`} variant="outline" size="sm">
            {t("Se profilen")}
          </ButtonLink>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Tabs
            label={t("Periode")}
            active={String(days)}
            items={Object.keys(PERIODS).map((key) => ({
              key,
              label: t(PERIOD_LABEL[PERIODS[key as keyof typeof PERIODS]]),
              href: pro || key === "30" ? `/innsikt?periode=${key}` : "/priser",
            }))}
          />
          {!pro && (
            <span className="inline-flex items-center gap-1.5 text-sm text-mist">
              <Lock className="size-3.5" /> {t("Lengre perioder med")} <a href="/priser" className="text-ice hover:underline">Pro</a>
            </span>
          )}
        </div>

        <section aria-label={t("Nøkkeltall")} className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile t={t} nf={nf} days={days} label={t("Profilvisninger")} value={data.profileViews.current} current={data.profileViews.current} previous={data.profileViews.previous} />
          <StatTile
            t={t}
            nf={nf}
            days={days}
            label={t("Prosjektvisninger")}
            value={data.projectViews.current}
            current={data.projectViews.current}
            previous={data.projectViews.previous}
            hint={t("{n} totalt", { n: data.projectViewsTotal.toLocaleString(nf) })}
          />
          <StatTile
            t={t}
            nf={nf}
            days={days}
            label={t("Nye følgere")}
            value={data.followers.current}
            current={data.followers.current}
            previous={data.followers.previous}
            hint={t("{n} følgere totalt", { n: data.followers.total })}
          />
          <StatTile
            t={t}
            nf={nf}
            days={days}
            label={t("Reaksjoner")}
            value={data.reactions.current}
            current={data.reactions.current}
            previous={data.reactions.previous}
            hint={t("{n} nye kommentarer", { n: data.comments.current })}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[22px] glass-card p-6">
            <h2 className="font-semibold tracking-tight">{days > 90 ? t("Profilvisninger per uke") : t("Profilvisninger per dag")}</h2>
            <p className="mt-1 text-sm text-mist">{t("Hvor mange som har åpnet profilen din.")}</p>
            <div className="mt-8">
              <DailyBars title={days > 90 ? t("Profilvisninger per uke") : t("Profilvisninger per dag")} days={data.profileViews.days} />
            </div>
          </div>
          <div className="rounded-[22px] glass-card p-6">
            <h2 className="font-semibold tracking-tight">{days > 90 ? t("Prosjektvisninger per uke") : t("Prosjektvisninger per dag")}</h2>
            <p className="mt-1 text-sm text-mist">{t("Alle prosjektene dine til sammen.")}</p>
            <div className="mt-8">
              <DailyBars title={days > 90 ? t("Prosjektvisninger per uke") : t("Prosjektvisninger per dag")} days={data.projectViews.days} />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[22px] glass-card p-6" aria-labelledby="besokende">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="besokende" className="flex items-center gap-2 font-semibold tracking-tight">
                <Eye className="size-4 text-mist" /> {t("Hvem har sett profilen din")}
              </h2>
              <p className="mt-1 text-sm text-mist">
                {visitors.count === 1
                  ? t("1 innlogget person de siste {period}.", { period: t(PERIOD_LABEL[days]) })
                  : t("{n} innloggede personer de siste {period}.", { n: visitors.count, period: t(PERIOD_LABEL[days]) })}
              </p>
            </div>
            {visitors.pro && <span className="inline-flex items-center gap-1 rounded-full glass-chip px-2.5 py-1 text-xs font-medium"><Sparkles className="size-3.5 text-warn" /> Pro</span>}
          </div>
          {visitors.visitors ? (
            visitors.visitors.length === 0 ? (
              <p className="mt-5 text-sm text-mist">{t("Ingen ennå. Del profilen din, så kommer de.")}</p>
            ) : (
              <ul className="mt-5 divide-y divide-line">
                {visitors.visitors.map((v) => (
                  <li key={v.username} className="flex items-center gap-3 py-3">
                    <Avatar name={v.name} image={v.image} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/@${v.username}`} className="font-medium hover:text-ice">
                        {v.name}
                      </Link>
                      {v.headline && <p className="truncate text-sm text-mist">{v.headline}</p>}
                    </div>
                    <p className="shrink-0 text-xs text-mist" suppressHydrationWarning>
                      {timeAgo(v.lastSeenAt, locale)}
                      {v.visits > 1 ? ` · ${t("{n} besøk", { n: v.visits })}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : visitors.hidden ? (
            <p className="mt-5 text-sm text-mist">
              {t("Du har skjult deg når du ser på andres profiler, og ser derfor heller ikke hvem som har sett din.")}{" "}
              <Link href="/profil/rediger/konto#personvern" className="text-ice hover:underline">
                {t("Endre")}
              </Link>
            </p>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-fill px-4 py-4">
              <p className="text-sm text-mist">{t("Med Pro ser du hvem de er, hva de jobber med og når de var innom.")}</p>
              <ButtonLink href="/priser" size="sm">
                {t("Se hvem")}
              </ButtonLink>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[22px] glass-card p-6">
          <h2 className="font-semibold tracking-tight">{t("Prosjektene dine")}</h2>
          <p className="mt-1 text-sm text-mist">{t("Sortert etter visninger de siste {period}.", { period: t(PERIOD_LABEL[days]) })}</p>
          {data.topProjects.length === 0 ? (
            <EmptyState className="mt-6" title={t("Ingen prosjekter ennå")} action={<ButtonLink href="/ny">{t("Del et prosjekt")}</ButtonLink>} />
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-mist">
                  <tr>
                    <th className="pb-3 font-medium">{t("Prosjekt")}</th>
                    <th className="w-[38%] pb-3 font-medium">{t("Visninger ({n} d)", { n: days })}</th>
                    <th className="pb-3 text-right font-medium">{t("Totalt")}</th>
                    <th className="pb-3 text-right font-medium">{t("Reaksjoner")}</th>
                    <th className="pb-3 text-right font-medium">{t("Kommentarer")}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.topProjects.map((p) => (
                    <tr key={p.id} className="border-t border-line/70">
                      <td className="py-3 pr-4">
                        <Link href={`/prosjekt/${p.id}`} className="font-medium text-fg hover:text-ice">
                          {p.title}
                        </Link>
                        {p.status === "draft" && <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">{t("Utkast")}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-2" aria-hidden="true">
                            <div className="h-full rounded-full bg-sea" style={{ width: `${(p.views30 / maxViews) * 100}%` }} />
                          </div>
                          <span className="w-10 text-right">{p.views30}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-mist">{p.viewsTotal}</td>
                      <td className="py-3 text-right text-mist">{p.reactions}</td>
                      <td className="py-3 text-right text-mist">{p.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 flex items-center gap-2 text-sm text-mist">
          <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
          {t("Visningstallene er anonyme. Hvem som har sett profilen viser bare innloggede som ikke har skjult seg. Dine egne besøk telles ikke.")}
        </p>
      </div>
    </main>
  );
}
