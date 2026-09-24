// Aktivitetskart som på GitHub: én rute per dag det siste året, mørkere jo mer som skjedde.

const WEEKS = 53;
const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

function level(n: number) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  if (n <= 5) return 3;
  return 4;
}

const FILL = [
  "bg-ink-2 ring-1 ring-inset ring-line/50",
  "bg-accent/25",
  "bg-accent/45",
  "bg-accent/70",
  "bg-accent",
];

export default function ActivityHeatmap({
  byDay,
  projects,
  comments,
}: {
  byDay: Record<string, number>;
  projects: number;
  comments: number;
}) {
  // Siste kolonne slutter i dag. Ukene starter på mandag.
  const today = new Date();
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const weekday = (end.getUTCDay() + 6) % 7;
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - weekday - (WEEKS - 1) * 7);

  const columns: { key: string; n: number; future: boolean; month: number; date: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + w * 7 + d);
      const key = day.toISOString().slice(0, 10);
      col.push({ key, n: byDay[key] ?? 0, future: day > end, month: day.getUTCMonth(), date: day.getUTCDate() });
    }
    columns.push(col);
  }

  const total = Object.values(byDay).reduce((a, b) => a + b, 0);
  const summary = `${projects} ${projects === 1 ? "prosjekt" : "prosjekter"} og ${comments} ${comments === 1 ? "kommentar" : "kommentarer"} det siste året`;

  return (
    <figure>
      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          <div className="mb-1.5 grid gap-[3px] pl-0 text-[10px] text-mist/70" style={{ gridTemplateColumns: `repeat(${WEEKS}, 11px)` }} aria-hidden="true">
            {columns.map((col, i) => {
              // Månedsnavnet står over uka der den første i måneden er.
              const firstOfMonth = col.find((c) => c.date === 1 && !c.future);
              return (
                <span key={i} className="whitespace-nowrap">
                  {firstOfMonth ? MONTHS[firstOfMonth.month] : ""}
                </span>
              );
            })}
          </div>
          <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 11px)", gridAutoColumns: "11px" }} role="img" aria-label={summary}>
            {columns.flatMap((col) =>
              col.map((cell) => (
                <span
                  key={cell.key}
                  title={cell.future ? undefined : `${cell.key}: ${cell.n === 0 ? "ingen aktivitet" : `aktivitet ${cell.n}`}`}
                  className={`size-[11px] rounded-[3px] ${cell.future ? "opacity-0" : FILL[level(cell.n)]}`}
                />
              )),
            )}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-mist">
        <span>{total === 0 ? "Ingen aktivitet det siste året ennå." : summary}</span>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          Mindre
          {FILL.map((f) => (
            <span key={f} className={`size-[11px] rounded-[3px] ${f}`} />
          ))}
          Mer
        </span>
      </figcaption>
    </figure>
  );
}
