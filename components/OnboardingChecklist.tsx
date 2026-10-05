import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { OnboardingStep } from "@/lib/profiles";

// «Kom i gang»-listen: hva som gjenstår før profilen er komplett.
export default async function OnboardingChecklist({ steps, title: heading = "Kom i gang" }: { steps: OnboardingStep[]; title?: string }) {
  const t = await getT();
  const title = t(heading);
  const done = steps.filter((s) => s.done).length;
  if (steps.length === 0 || done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <section aria-label={title} className="rounded-[22px] glass-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs tabular-nums text-mist">
          {done}/{steps.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden="true">
        <div className="h-full rounded-full bg-sea transition-all duration-700" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`group flex items-start gap-3 rounded-[14px] px-2 py-2 transition hover:bg-fill ${s.done ? "opacity-60" : ""}`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                  s.done ? "bg-success text-white" : "text-transparent ring-[1.5px] ring-inset ring-mist/50"
                }`}
                aria-hidden="true"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${s.done ? "text-mist line-through" : "text-fg"}`}>{t(s.label)}</span>
                {!s.done && <span className="block text-[13px] leading-5 text-mist">{t(s.description, s.vars)}</span>}
              </span>
              {!s.done && <ArrowRight className="mt-0.5 size-4 shrink-0 text-mist transition group-hover:translate-x-0.5" aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
