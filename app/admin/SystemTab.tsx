import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { EnvCheck, EnvStatus } from "@/lib/env";
import type { getErrorSummary } from "@/lib/errors";
import { timeAgo } from "@/lib/format";

const STATUS: Record<EnvStatus, { Icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { Icon: CheckCircle2, className: "text-success", label: "OK" },
  info: { Icon: CircleDashed, className: "text-mist", label: "Valgfritt" },
  warn: { Icon: AlertTriangle, className: "text-warn", label: "Bør fikses" },
  error: { Icon: XCircle, className: "text-danger", label: "Må fikses" },
};

const SOURCE_LABEL = { server: "Server", action: "Handling", client: "Nettleser" } as Record<string, string>;

export default function SystemTab({ checks, errors }: { checks: EnvCheck[]; errors: Awaited<ReturnType<typeof getErrorSummary>> }) {
  const groups = [...new Set(checks.map((c) => c.group))];
  const problems = checks.filter((c) => c.status === "error" || c.status === "warn").length;

  return (
    <div className="mt-8 space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Klar for lansering?</h2>
        <p className="mt-1 text-sm text-mist">
          {problems === 0 ? "Oppsettet ser komplett ut." : `${problems} ting i oppsettet bør ses på.`} Verdiene vises aldri,
          bare om de er satt. Endres under Environment hos Render.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group} className="rounded-[22px] glass-card p-5">
              <h3 className="caption">{group}</h3>
              <ul className="mt-3 space-y-3">
                {checks
                  .filter((c) => c.group === group)
                  .map((c) => {
                    const { Icon, className, label } = STATUS[c.status];
                    return (
                      <li key={c.key} className="flex gap-3">
                        <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-label={label} />
                        <div className="min-w-0">
                          <p className="break-words font-mono text-[12.5px]">{c.key}</p>
                          <p className="text-sm text-mist">{c.message}</p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Feil</h2>
        <p className="mt-1 text-sm text-mist">
          {errors.totals?.day ?? 0} siste døgn · {errors.totals?.week ?? 0} siste 7 dager. Like feil er slått sammen. Eldre enn 30 dager slettes.
        </p>
        {errors.groups.length === 0 ? (
          <p className="mt-4 rounded-[22px] glass-card p-5 text-sm text-mist">Ingen feil registrert den siste uken.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {errors.groups.map((g) => (
              <li key={`${g.source}-${g.event}-${g.message}`} className="px-5 py-4">
                <p className="text-xs text-mist">
                  {SOURCE_LABEL[g.source] ?? g.source} · {g.event} · sist <span suppressHydrationWarning>{timeAgo(g.last)}</span>
                  {g.path && ` · ${g.path}`}
                </p>
                <p className="mt-1 flex items-start justify-between gap-4">
                  <span className="break-words font-mono text-[13px]">{g.message}</span>
                  <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-danger">{g.count}×</span>
                </p>
              </li>
            ))}
          </ul>
        )}
        {errors.recent[0]?.stack && (
          <details className="mt-4 rounded-[22px] glass-card p-5">
            <summary className="cursor-pointer text-sm font-medium">Siste feil med stakkspor</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-mist">{errors.recent[0].stack}</pre>
          </details>
        )}
      </section>
    </div>
  );
}
