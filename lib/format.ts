// Norske dato-formater. Brukes både på server og klient.

const rtf = new Intl.RelativeTimeFormat("nb-NO", { numeric: "auto" });

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "akkurat nå";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(seconds / 86400), "day");
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

// "2024-05" -> "mai 2024", "2024" -> "2024"
export function formatYearMonth(value: string | null | undefined) {
  if (!value) return null;
  const [year, month] = value.split("-");
  if (!month) return year;
  return new Date(Number(year), Number(month) - 1)
    .toLocaleDateString("nb-NO", { month: "short", year: "numeric" })
    .replace(".", "");
}

export function formatPeriod(start: string | null, end: string | null) {
  const from = formatYearMonth(start);
  const to = end ? formatYearMonth(end) : "nå";
  if (!from) return end ? to : null;
  return `${from} – ${to}`;
}
