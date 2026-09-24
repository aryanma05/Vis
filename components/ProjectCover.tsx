// Forside for prosjekter uten bilder: en «blueprint» i Vis-fargene, med tittelen
// satt stort. Fargene velges ut fra tittelen, så samme prosjekt alltid ser likt ut.
const PALETTES = [
  ["#071A52", "#0B3C5D", "#C7F9FF"],
  ["#062A3A", "#086788", "#C7F9FF"],
  ["#0A245E", "#12506B", "#9FE0A8"],
  ["#041C32", "#0E4D64", "#FFC27A"],
  ["#0C1B33", "#2E5F6B", "#C7F9FF"],
  ["#081F4A", "#1C4E80", "#B9A6FF"],
  ["#10183a", "#3a2f7a", "#FF9FB5"],
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function coverColors(seed: string) {
  const [from, to, accent] = PALETTES[hash(seed) % PALETTES.length];
  return { from, to, accent, angle: 120 + (hash(seed) % 60) };
}

// showTitle=false brukes på prosjektsiden, der tittelen allerede står over.
export default function ProjectCover({
  title,
  label,
  showTitle = true,
  children,
}: {
  title: string;
  label?: string;
  showTitle?: boolean;
  children?: React.ReactNode;
}) {
  const { from, to, accent, angle } = coverColors(title);
  const grid = `color-mix(in srgb, ${accent} 16%, transparent)`;
  const bigGrid = `color-mix(in srgb, ${accent} 24%, transparent)`;

  return (
    <div className="@container relative size-full overflow-hidden" style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`, backgroundSize: "22px 22px" }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `linear-gradient(${bigGrid} 1px, transparent 1px), linear-gradient(90deg, ${bigGrid} 1px, transparent 1px)`, backgroundSize: "110px 110px" }}
      />
      {/* Et diskré «teknisk» motiv: sirkel og siktelinjer. */}
      <svg className="absolute -right-6 -top-6 size-40 opacity-30" viewBox="0 0 160 160" fill="none" aria-hidden="true" style={{ color: accent }}>
        <circle cx="80" cy="80" r="56" stroke="currentColor" />
        <circle cx="80" cy="80" r="30" stroke="currentColor" strokeDasharray="3 5" />
        <path d="M80 0v160M0 80h160" stroke="currentColor" />
      </svg>
      {label && (
        <span className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: `color-mix(in srgb, ${accent} 75%, white)` }}>
          {label}
        </span>
      )}
      {showTitle && (
        <p className="absolute inset-x-5 bottom-5 line-clamp-3 text-2xl font-bold leading-[1.02] tracking-tight text-white @xs:text-3xl @md:text-5xl">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
