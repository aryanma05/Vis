import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { OnboardingStep } from "@/lib/profiles";

// «Kom i gang»-listen: hva som gjenstår før profilen er komplett.
export default function OnboardingChecklist({ steps, title = "Kom i gang" }: { steps: OnboardingStep[]; title?: string }) {
  const done = steps.filter((s) => s.done).length;
  if (steps.length === 0 || done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <section aria-label={title} className="rounded-3xl border border-line bg-surface/60 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-xs text-mist">
          {done}/{steps.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-2" aria-hidden="true">
        <div className="h-full rounded-full bg-ice transition-all duration-700" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2 ${s.done ? "opacity-60" : ""}`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  s.done ? "border-success bg-success text-ink" : "border-line text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${s.done ? "text-mist line-through" : "text-fg"}`}>{s.label}</span>
                {!s.done && <span className="block text-[13px] leading-5 text-mist">{s.description}</span>}
              </span>
              {!s.done && <ArrowRight className="mt-0.5 size-4 shrink-0 text-mist transition group-hover:translate-x-0.5 group-hover:text-ice" aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
