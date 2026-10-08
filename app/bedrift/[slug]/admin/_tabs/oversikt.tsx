import Link from "next/link";
import { AlertTriangle, CalendarClock, Check, ChevronRight, Clock, FileSignature, Hourglass, MailPlus, PiggyBank, ShieldCheck, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import DailyBars from "@/components/insights/DailyBars";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { AUDIT_ACTION_LABELS } from "@/lib/company-labels";
import { getAttention, getCompanyChecklist, getFeed, getOverview, OVERVIEW_PERIODS, type AttentionKey } from "@/lib/company-stats";
import { timeAgo } from "@/lib/format";
import { ROI_DEFAULTS, ROI_RATES } from "@/lib/roi";
import type { AdminCtx } from "./context";

const ATTENTION: Record<AttentionKey, { text: string; Icon: typeof Clock; tone: string }> = {
  waiting: { text: "søkere har ventet over 7 dager i Ny", Icon: Clock, tone: "text-warn" },
  interviews: { text: "intervjuer i dag og i morgen", Icon: CalendarClock, tone: "text-sea" },
  deadlines: { text: "stillinger har frist innen 7 dager", Icon: Hourglass, tone: "text-warn" },
  invites: { text: "invitasjoner utløper snart", Icon: MailPlus, tone: "text-mist" },
  expiring: { text: "søknader slettes innen 14 dager", Icon: Trash2, tone: "text-mist" },
  terms: { text: "Databehandleravtalen er ikke godtatt", Icon: FileSignature, tone: "text-danger" },
  twoFactor: { text: "medlemmer mangler tofaktor", Icon: ShieldCheck, tone: "text-danger" },
};

const kr = (n: number, locale: string) => (locale === "en" ? `NOK ${n.toLocaleString("en-GB")}` : `${n.toLocaleString("nb-NO")} kr`);

// Liten linje i SVG. Bare pynt; tallene står ved siden av.
function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values);
  const points = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(28 - (v / max) * 26).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" className={`h-8 w-full ${className}`}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="[animation:draw_1.2s_ease-out_both] [stroke-dasharray:1]" />
    </svg>
  );
}

function Delta({ current, previous, invert = false, t }: { current: number | null; previous: number | null; invert?: boolean; t: AdminCtx["t"] }) {
  if (current === null || previous === null || previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className="text-xs text-mist">{t("som før")}</span>;
  const good = invert ? change < 0 : change > 0;
  return <span className={`text-xs font-semibold ${good ? "text-success" : "text-warn"}`}>{change > 0 ? `+${change}` : change} %</span>;
}

export default async function OversiktTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, business, base, t, locale, query } = ctx;
  const [overview, attention, feed, steps] = await Promise.all([
    getOverview(user.id, company.id, { days: Number(query.periode) || undefined }),
    getAttention(user.id, company.id, base),
    getFeed(user.id, company.id),
    getCompanyChecklist(user.id, company.id, base),
  ]);
  const { roi, funnel } = overview;
  const tiles = [
    { label: t("Nye søkere"), value: overview.applicants.current.toLocaleString(locale), delta: <Delta current={overview.applicants.current} previous={overview.applicants.previous} t={t} />, spark: overview.applicants.spark, tone: "text-sea" },
    { label: t("Visninger"), value: overview.views.current.toLocaleString(locale), delta: <Delta current={overview.views.current} previous={overview.views.previous} t={t} />, spark: overview.views.spark, tone: "text-ice" },
    {
      label: t("Svartid (median)"),
      value: overview.response.current === null ? "–" : t("{n} d", { n: overview.response.current }),
      delta: <Delta current={overview.response.current} previous={overview.response.previous} invert t={t} />,
      spark: overview.response.spark,
      tone: "text-warn",
    },
    { label: t("Spart med Vis"), value: `${t("ca.")} ${kr(roi.kroner, locale)}`, delta: <span className="text-xs text-mist">{t("{n} timer", { n: roi.hours })}</span>, spark: roi.spark, tone: "text-success" },
  ];
  const stages = [
    { label: t("Visninger"), n: funnel.views },
    { label: t("Søkere"), n: funnel.applicants },
    { label: t("Intervju"), n: funnel.interview },
    { label: t("Tilbud"), n: funnel.offer },
    { label: t("Ansatt"), n: funnel.hired },
  ];
  const top = Math.max(...stages.map((s) => s.n), 1);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mist">{t("Siste {n} dager, sammenlignet med perioden før.", { n: overview.days })}</p>
          {business && (
            <nav aria-label={t("Periode")} className="flex gap-1 rounded-full bg-fill p-1">
              {OVERVIEW_PERIODS.map((d) => (
                <Link key={d} href={d === 30 ? base : `${base}?periode=${d}`} aria-current={overview.days === d ? "page" : undefined} className={`rounded-full px-3 py-1 text-xs font-semibold ${overview.days === d ? "bg-primary text-on-primary" : "text-mist hover:text-fg"}`}>
                  {t("{n} d", { n: d })}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <li key={tile.label} className="fade-up rounded-[22px] glass-card p-4" style={{ animationDelay: `${i * 60}ms` }}>
              <p className="text-xs font-medium text-mist">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{tile.value}</p>
              <div className="mt-0.5 h-4">{tile.delta}</div>
              <Sparkline values={tile.spark} className={`mt-2 ${tile.tone}`} />
            </li>
          ))}
        </ul>

        <section className="fade-up rounded-[22px] glass-card p-6" style={{ animationDelay: "240ms" }}>
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-warn" /> {t("Trenger oppmerksomhet")}
          </h2>
          {attention.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-mist">
              <Check className="size-4 text-success" /> {t("Alt er à jour. Godt jobbet!")}
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {attention.map((a) => {
                const { text, Icon, tone } = ATTENTION[a.key];
                const row = (
                  <>
                    <span className={`grid size-9 shrink-0 place-items-center rounded-[12px] bg-fill ${tone}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">{a.key === "terms" ? t(text) : `${a.count} ${t(text)}`}</span>
                    {a.href && <ChevronRight className="size-4 text-mist" />}
                  </>
                );
                return (
                  <li key={a.key}>
                    {a.href ? (
                      <Link href={a.href} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-fill">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-2.5">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="fade-up rounded-[22px] glass-card p-6" style={{ animationDelay: "300ms" }}>
            <h2 className="font-semibold">{t("Søknader per dag")}</h2>
            <div className="mt-4">
              <DailyBars title={t("Søknader per dag")} days={overview.daily} unit="søknader" />
            </div>
          </section>
          <section className="fade-up rounded-[22px] glass-card p-6" style={{ animationDelay: "360ms" }}>
            <h2 className="font-semibold">{t("Fra visning til ansettelse")}</h2>
            <ul className="mt-4 space-y-3" aria-label={t("Trakten")}>
              {stages.map((s, i) => (
                <li key={s.label} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
                  <span className="text-mist">{s.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-fill">
                    <span className={`block h-full rounded-full ${i === stages.length - 1 ? "bg-success" : "bg-sea"}`} style={{ width: `${Math.max((s.n / top) * 100, s.n > 0 ? 3 : 0)}%`, opacity: 1 - i * 0.12 }} />
                  </span>
                  <span className="tabular-nums">{s.n.toLocaleString(locale)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="fade-up relative overflow-hidden rounded-[22px] glass-card p-6" style={{ animationDelay: "420ms" }}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, var(--success), transparent 70%)" }} />
          <h2 className="flex items-center gap-2 font-semibold">
            <PiggyBank className="size-4 text-success" /> {t("Spart med Vis")}
          </h2>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            {t("ca.")} {kr(roi.kroner, locale)} <span className="text-mist">·</span> {t("{n} timer", { n: roi.hours })}
          </p>
          <p className="mt-1 text-sm text-mist">
            {t("Siste {n} dager, eks. mva.", { n: overview.days })}
            {roi.multiple !== null && roi.multiple >= 1 && ` ${t("Det er ca. {n} ganger abonnementsprisen.", { n: roi.multiple })}`}
          </p>
          {roi.parts.length > 0 && (
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {roi.parts
                .filter((p) => p.count > 0)
                .map((p) => (
                  <li key={p.key} className="flex justify-between rounded-[12px] bg-fill px-3 py-2">
                    <span className="text-mist">{t(PART_LABEL[p.key], { n: p.count })}</span>
                    <span className="tabular-nums">{p.kroner >= 1 ? kr(Math.round(p.kroner), locale) : t("{n} t", { n: Math.round(p.hours * 10) / 10 })}</span>
                  </li>
                ))}
            </ul>
          )}
          {roi.agency > 0 && (
            <p className="mt-3 rounded-[12px] bg-fill px-3 py-2 text-sm">
              {t("I tillegg slapp dere byråhonorar på ca. {sum} for ansettelsene dere ellers ville brukt byrå på.", { sum: kr(roi.agency, locale) })}
            </p>
          )}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-ice">{t("Slik regner vi")}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-mist">
              <li>{t("Hver søknad i samme format sparer ca. {n} minutter med lesing og sortering.", { n: ROI_RATES.applicationMinutes })}</li>
              <li>{t("Hver selvbooket intervjutid sparer ca. {n} minutter med e-post frem og tilbake.", { n: ROI_RATES.interviewHours * 60 })}</li>
              <li>{t("Hver stilling som erstatter en betalt annonse sparer annonseprisen (standard {sum}, FINN).", { sum: kr(ROI_DEFAULTS.adPrice, locale) })}</li>
              <li>{t("Timer regnes om med {sum} per time. Tallene rundes ned og telles bare for det dere selv har registrert.", { sum: kr(ROI_DEFAULTS.hourlyCost, locale) })}</li>
            </ul>
          </details>
        </section>
      </div>

      <aside className="space-y-6">
        {steps.some((s) => !s.done) && <OnboardingChecklist steps={steps} title={t("Kom i gang med bedriften")} />}
        <section className="rounded-[22px] glass-card p-5">
          <h2 className="font-semibold">{t("Aktivitet")}</h2>
          {feed.length === 0 ? (
            <p className="mt-3 text-sm text-mist">{t("Ingenting har skjedd ennå. Legg ut en stilling, så begynner det å skje ting her.")}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {feed.map((f) => (
                <li key={f.id} className="flex gap-3 text-sm">
                  <Avatar name={f.person?.name ?? "?"} image={f.person?.image ?? null} size={30} />
                  <p className="min-w-0 flex-1">
                    <span className="font-medium">{f.person?.name ?? t("Noen")}</span>{" "}
                    <span className="text-mist">
                      {f.kind === "application" ? t("søkte på") : f.action ? t(AUDIT_ACTION_LABELS[f.action]) : ""}
                      {f.label && ` «${f.label}»`}
                    </span>
                    <span className="block text-xs text-mist" suppressHydrationWarning>
                      {timeAgo(f.createdAt, locale)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {ctx.role === "owner" || ctx.role === "admin" ? (
            <Link href={`${base}?fane=personvern`} className="mt-4 inline-block text-sm text-ice hover:underline">
              {t("Se hele loggen")}
            </Link>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

const PART_LABEL = {
  applications: "{n} søknader i samme format",
  hires: "{n} ansettelser",
  interviews: "{n} selvbookede intervjuer",
  messages: "{n} svar sendt fra mal",
  ads: "{n} annonser dere slapp å kjøpe",
} as const;
