import type { KeyMetrics, WeekPoint } from "@/lib/metrics";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[18px] glass-card p-4">
      <dt className="text-sm text-mist">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight">{value}</dd>
      {hint && <p className="mt-1 text-xs text-mist/80">{hint}</p>}
    </div>
  );
}

const percent = (v: number | null) => (v === null ? "–" : `${v} %`);
const shortWeek = (iso: string) => new Date(iso).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });

// Enkle stolper uten diagrambibliotek. Tallet står over hver stolpe.
function Bars({ title, points }: { title: string; points: WeekPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <figure className="rounded-[22px] glass-card p-5">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label={`${title}: ${points.map((p) => `${shortWeek(p.week)} ${p.value}`).join(", ")}`}>
        {points.map((p) => (
          <div key={p.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-mist">{p.value || ""}</span>
            <span className="w-full rounded-t-md bg-sea/70" style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-mist">
        <span>{shortWeek(points[0]?.week ?? new Date().toISOString())}</span>
        <span>denne uken</span>
      </div>
    </figure>
  );
}

type Billing = { pro: number; business: number; proGranted: number; businessGranted: number; mrr: number } | null;

export default function MetricsTab({ metrics: m, billing }: { metrics: KeyMetrics; billing?: Billing }) {
  return (
    <div className="mt-8 space-y-10">
      {billing && (
        <section>
          <h2 className="text-lg font-semibold">Inntekt</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Månedlig inntekt (MRR)" value={`${billing.mrr.toLocaleString("nb-NO")} kr`} hint="Årsabonnement regnes per måned." />
            <Stat label="Betalende Pro" value={billing.pro} hint={billing.proGranted ? `+ ${billing.proGranted} gitt av admin` : undefined} />
            <Stat label="Betalende bedrifter" value={billing.business} hint={billing.businessGranted ? `+ ${billing.businessGranted} gitt av admin` : undefined} />
            <Stat label="Andel med Pro" value={m.users ? `${Math.round(((billing.pro + billing.proGranted) / m.users) * 100)} %` : "–"} />
          </dl>
        </section>
      )}
      <section>
        <h2 className="text-lg font-semibold">Vekst</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Brukere totalt" value={m.users} />
          <Stat label="Nye siste 7 dager" value={m.users7} />
          <Stat label="Nye siste 30 dager" value={m.users30} />
          <Stat label="Publiserte prosjekter" value={m.projects} hint={`${m.projects7} siste 7 dager`} />
        </dl>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Bars title="Nye brukere per uke" points={m.signups} />
          <Bars title="Publiserte prosjekter per uke" points={m.published} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Aktivering</h2>
        <p className="mt-1 text-sm text-mist">
          Av de {m.activation.cohort} som ble med for 2–30 dager siden: hvor mange har gjort det som gjør profilen verdt å dele?
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Har publisert et prosjekt" value={percent(m.activation.published)} hint="Viktigste tallet. Mål: over 40 %." />
          <Stat label="Har fylt ut tittel" value={percent(m.activation.profile)} />
          <Stat label="Har lagt inn CV" value={percent(m.activation.cv)} />
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Bruk og gjenbruk</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Aktive siste døgn" value={m.active.dau} />
          <Stat label="Aktive siste 7 dager" value={m.active.wau} />
          <Stat label="Aktive siste 30 dager" value={m.active.mau} />
          <Stat
            label="Kom tilbake etter 30 dager"
            value={percent(m.retention.returned)}
            hint={m.retention.cohort ? `av ${m.retention.cohort} som ble med for 30–60 dager siden` : "Ingen ble med for 30–60 dager siden."}
          />
        </dl>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Kommentarer (7 d)" value={m.engagement.comments} />
          <Stat label="Reaksjoner (7 d)" value={m.engagement.reactions} />
          <Stat label="Nye følgere (7 d)" value={m.engagement.follows} />
          <Stat label="Profilvisninger (7 d)" value={m.engagement.profileViews} />
          <Stat label="Prosjektvisninger (7 d)" value={m.engagement.projectViews} />
        </dl>
        <p className="mt-3 text-xs text-mist/80">
          «Aktiv» betyr at innloggingen ble brukt. Vis sporer ikke enkeltbesøk, så tallene er omtrentlige.
        </p>
      </section>
    </div>
  );
}
