// Forside for prosjekter uten bilder: en «blueprint» i Vis-fargene, med tittelen
// satt stort. Fargene velges ut fra tittelen, så samme prosjekt alltid ser likt ut.
const PALETTES = [
  ["#071A52", "#0B3C5D"],
  ["#062A3A", "#086788"],
  ["#0A245E", "#12506B"],
  ["#041C32", "#0E4D64"],
  ["#0C1B33", "#2E5F6B"],
  ["#081F4A", "#1C4E80"],
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
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
  const [from, to] = PALETTES[hash(title) % PALETTES.length];
  const angle = 120 + (hash(title) % 60);

  return (
    <div className="@container relative size-full overflow-hidden" style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}>
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(#C7F9FF 1px, transparent 1px), linear-gradient(90deg, #C7F9FF 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(#C7F9FF 1px, transparent 1px), linear-gradient(90deg, #C7F9FF 1px, transparent 1px)",
          backgroundSize: "110px 110px",
        }}
      />
      <svg className="absolute right-5 top-5 h-8 w-8 text-ice/40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="11" stroke="currentColor" />
        <path d="M16 0v32M0 16h32" stroke="currentColor" />
      </svg>
      {label && (
        <span className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ice/70">{label}</span>
      )}
      {showTitle && (
        <p className="absolute inset-x-5 bottom-5 line-clamp-3 text-2xl font-semibold leading-[1.05] tracking-tight text-white @xs:text-3xl @md:text-5xl">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
