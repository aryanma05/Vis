import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { EnvCheck, EnvStatus } from "@/lib/env";
import type { getErrorSummary } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import type { GithubStatus } from "@/lib/github";

const STATUS: Record<EnvStatus, { Icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { Icon: CheckCircle2, className: "text-success", label: "OK" },
  info: { Icon: CircleDashed, className: "text-mist", label: "Valgfritt" },
  warn: { Icon: AlertTriangle, className: "text-warn", label: "Bør fikses" },
  error: { Icon: XCircle, className: "text-danger", label: "Må fikses" },
};

const SOURCE_LABEL = { server: "Server", action: "Handling", client: "Nettleser" } as Record<string, string>;

// Om GitHub-importen virker: serverens GITHUB_TOKEN og hvor mye som er igjen av grensen.
function GithubStatusCard({ status }: { status: GithubStatus | null }) {
  if (!status) return null;
  const reset = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }) : "");
  const state: { status: EnvStatus; text: string } =
    status.token === "ok"
      ? {
          status: status.remaining !== null && status.remaining < 100 ? "warn" : "ok",
          text: `GITHUB_TOKEN virker. ${status.remaining?.toLocaleString("nb-NO")} av ${status.limit?.toLocaleString("nb-NO")} forespørsler igjen denne timen (nullstilles ${reset(status.resetAt)}).`,
        }
      : status.token === "invalid"
        ? { status: "error", text: "GITHUB_TOKEN er ugyldig eller utløpt. Import fra GitHub bruker da den anonyme grensen. Lag en ny token og bytt den hos Render." }
        : status.token === "missing"
          ? {
              status: "error",
              text: `GITHUB_TOKEN mangler. Da deler appen 60 forespørsler i timen med alle andre på samme IP-adresse hos Render${status.anonRemaining !== null ? ` (${status.anonRemaining} igjen nå)` : ""}. Import fra GitHub feiler derfor for de som ikke har koblet til GitHub.`,
            }
          : { status: "warn", text: "Fikk ikke svar fra GitHub akkurat nå." };
  const { Icon, className, label } = STATUS[state.status];
  return (
    <section>
      <h2 className="text-lg font-semibold">GitHub-import</h2>
      <div className="mt-4 flex gap-3 rounded-[22px] glass-card p-5">
        <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-label={label} />
        <div className="min-w-0 text-sm">
          <p>{state.text}</p>
          {status.token !== "ok" && (
            <p className="mt-2 text-mist">
              Lag en «fine-grained» token på github.com/settings/personal-access-tokens med «Public repositories (read-only)» og lang utløpstid, og legg den inn
              som GITHUB_TOKEN under Environment hos Render.
            </p>
          )}
          {status.lastRateLimit && (
            <p className="mt-2 text-mist">
              Siste gang grensen ble nådd: {status.lastRateLimit.kind === "anon" ? "anonymt" : status.lastRateLimit.kind === "server" ? "med GITHUB_TOKEN" : "med en brukers token"}, nullstilles{" "}
              {reset(status.lastRateLimit.resetAt)}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function SystemTab({
  checks,
  errors,
  github = null,
}: {
  checks: EnvCheck[];
  errors: Awaited<ReturnType<typeof getErrorSummary>>;
  github?: GithubStatus | null;
}) {
  const groups = [...new Set(checks.map((c) => c.group))];
  const problems = checks.filter((c) => c.status === "error" || c.status === "warn").length;

  return (
    <div className="mt-8 space-y-10">
      <GithubStatusCard status={github} />

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
