import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, ShieldCheck } from "lucide-react";
import DailyBars from "@/components/insights/DailyBars";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getInsights } from "@/lib/insights";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Innsikt", robots: { index: false } };

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (previous === 0 && current === 0) return <span className="text-xs text-mist">Ingen endring</span>;
  // Prosent sier lite når forrige periode nesten var tom (+2700 %), da vises antallet.
  const pct = previous < 20 ? null : Math.round((diff / previous) * 100);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const tone = diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-mist";
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 text-xs font-medium ${tone}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {diff > 0 ? "+" : ""}
      {pct === null ? diff.toLocaleString("nb-NO") : `${pct.toLocaleString("nb-NO")} %`}
      <span className="font-normal text-mist">mot forrige 30 dager</span>
    </span>
  );
}

function StatTile({ label, value, current, previous, hint }: { label: string; value: number; current: number; previous: number; hint?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface/50 p-4 sm:p-5">
      <p className="text-sm text-mist">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{value.toLocaleString("nb-NO")}</p>
      <div className="mt-2">
        <Delta current={current} previous={previous} />
      </div>
      {hint && <p className="mt-2 text-xs text-mist/70">{hint}</p>}
    </div>
  );
}

export default async function InsightsPage() {
  const user = await requireUser();
  const data = await getInsights(user.id);
  const maxViews = Math.max(...data.topProjects.map((p) => p.views30), 1);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-mono">Siste 30 dager</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Innsikt</h1>
          </div>
          <ButtonLink href={`/@${user.username}`} variant="outline" size="sm">
            Se profilen
          </ButtonLink>
        </div>

        <section aria-label="Nøkkeltall" className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile label="Profilvisninger" value={data.profileViews.current} current={data.profileViews.current} previous={data.profileViews.previous} />
          <StatTile
            label="Prosjektvisninger"
            value={data.projectViews.current}
            current={data.projectViews.current}
            previous={data.projectViews.previous}
            hint={`${data.projectViewsTotal.toLocaleString("nb-NO")} totalt`}
          />
          <StatTile label="Nye følgere" value={data.followers.current} current={data.followers.current} previous={data.followers.previous} hint={`${data.followers.total} følgere totalt`} />
          <StatTile
            label="Reaksjoner"
            value={data.reactions.current}
            current={data.reactions.current}
            previous={data.reactions.previous}
            hint={`${data.comments.current} nye kommentarer`}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-line p-6">
            <h2 className="font-semibold tracking-tight">Profilvisninger per dag</h2>
            <p className="mt-1 text-sm text-mist">Hvor mange som har åpnet profilen din.</p>
            <div className="mt-8">
              <DailyBars title="Profilvisninger per dag" days={data.profileViews.days} />
            </div>
          </div>
          <div className="rounded-3xl border border-line p-6">
            <h2 className="font-semibold tracking-tight">Prosjektvisninger per dag</h2>
            <p className="mt-1 text-sm text-mist">Alle prosjektene dine til sammen.</p>
            <div className="mt-8">
              <DailyBars title="Prosjektvisninger per dag" days={data.projectViews.days} />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-line p-6">
          <h2 className="font-semibold tracking-tight">Prosjektene dine</h2>
          <p className="mt-1 text-sm text-mist">Sortert etter visninger de siste 30 dagene.</p>
          {data.topProjects.length === 0 ? (
            <EmptyState className="mt-6" title="Ingen prosjekter ennå" action={<ButtonLink href="/ny">Del et prosjekt</ButtonLink>} />
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-mist">
                  <tr>
                    <th className="pb-3 font-medium">Prosjekt</th>
                    <th className="w-[38%] pb-3 font-medium">Visninger (30 d)</th>
                    <th className="pb-3 text-right font-medium">Totalt</th>
                    <th className="pb-3 text-right font-medium">Reaksjoner</th>
                    <th className="pb-3 text-right font-medium">Kommentarer</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.topProjects.map((p) => (
                    <tr key={p.id} className="border-t border-line/70">
                      <td className="py-3 pr-4">
                        <Link href={`/prosjekt/${p.id}`} className="font-medium text-fg hover:text-ice">
                          {p.title}
                        </Link>
                        {p.status === "draft" && <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-warn">Utkast</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-2" aria-hidden="true">
                            <div className="h-full rounded-full bg-ice" style={{ width: `${(p.views30 / maxViews) * 100}%` }} />
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
          Vi teller bare hvor mange som ser på – ikke hvem. Dine egne besøk telles ikke.
        </p>
      </div>
    </main>
  );
}
