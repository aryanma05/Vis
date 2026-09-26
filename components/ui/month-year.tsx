"use client";

import { selectClass } from "@/components/ui/field";

const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 6 - 1960 }, (_, i) => THIS_YEAR + 5 - i);

// Verdien er "ÅÅÅÅ-MM", "ÅÅÅÅ" eller "" (ikke satt). Måned er valgfritt.
export default function MonthYear({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [year = "", month = ""] = value ? value.split("-") : [];
  const update = (y: string, m: string) => onChange(y ? (m ? `${y}-${m}` : y) : "");

  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      <select
        aria-label={`${label}, måned`}
        value={month}
        disabled={disabled || !year}
        onChange={(e) => update(year, e.target.value)}
        className={`${selectClass} w-[6.5rem] disabled:opacity-40`}
      >
        <option value="">Mnd</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label}, år`}
        value={year}
        disabled={disabled}
        onChange={(e) => update(e.target.value, month)}
        className={`${selectClass} w-28 disabled:opacity-40`}
      >
        <option value="">År</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
