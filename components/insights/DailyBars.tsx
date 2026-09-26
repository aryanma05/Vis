"use client";

import { useId, useState } from "react";

type Day = { day: string; views: number };

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString("nb-NO", opts);

// Runde tall på y-aksen: 0, 5, 10 … eller 0, 50, 100 …
function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max));
  // Midtstreken er max / 2, så den skal også bli et helt tall.
  for (const m of step === 1 ? [6, 8, 10] : [1, 2, 3, 4, 5, 6, 8, 10]) {
    if (m * step >= max) return m * step;
  }
  return 10 * step;
}

// Visninger per dag som søyler. Én serie, én akse; hold musen over (eller tab til) en
// søyle for å se tallet. Tallene finnes også i tabellen under.
export default function DailyBars({ title, days }: { title: string; days: Day[] }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...days.map((d) => d.views), 0));
  const ticks = [0, max / 2, max];
  const total = days.reduce((n, d) => n + d.views, 0);

  return (
    <figure aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="sr-only">
        {title}: {total} totalt de siste {days.length} dagene
      </figcaption>
      <div className="relative">
        <div className="relative ml-9 h-44">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-line/70" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden="true">
              <span className="absolute -left-9 -translate-y-1/2 font-mono text-[10.5px] tabular-nums text-mist/70">{t.toLocaleString("nb-NO")}</span>
            </div>
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
            {days.map((d, i) => (
              <button
                key={d.day}
                type="button"
                aria-label={`${fmtDay(d.day, { day: "numeric", month: "long" })}: ${d.views} visninger`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] transition-[height,background-color] duration-500 ${
                    active === i ? "bg-fg" : "bg-ice"
                  } ${d.views === 0 ? "opacity-0" : ""}`}
                  style={{ height: `${Math.max((d.views / max) * 100, d.views > 0 ? 2 : 0)}%` }}
                />
                <span className="absolute inset-x-0 bottom-0 top-0 rounded-md group-focus-visible:ring-2 group-focus-visible:ring-ice" />
              </button>
            ))}
          </div>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
            >
              <span className="block text-sm font-semibold text-fg">{days[active].views.toLocaleString("nb-NO")} visninger</span>
              <span className="text-mist">{fmtDay(days[active].day, { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
          )}
        </div>
        <div className="ml-9 mt-2 flex justify-between font-mono text-[10.5px] text-mist/70" aria-hidden="true">
          <span>{fmtDay(days[0].day, { day: "numeric", month: "short" })}</span>
          <span>{fmtDay(days[Math.floor(days.length / 2)].day, { day: "numeric", month: "short" })}</span>
          <span>I dag</span>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-mist hover:text-fg">Vis som tabell</summary>
        <table className="mt-3 w-full text-left text-[13px]">
          <thead>
            <tr className="text-mist">
              <th className="py-1.5 font-medium">Dato</th>
              <th className="py-1.5 text-right font-medium">Visninger</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...days].reverse().map((d) => (
              <tr key={d.day} className="border-t border-line/60">
                <td className="py-1.5">{fmtDay(d.day, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="py-1.5 text-right">{d.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
