// Forside for prosjekter uten bilder: en rolig fargeflate med tittelen. Fargene velges
// ut fra tittelen, så samme prosjekt alltid ser likt ut.
const PALETTES = [
  ["#1e3a8a", "#3b82f6"],
  ["#0f3d3e", "#2f8f83"],
  ["#3b1d5a", "#8b5cf6"],
  ["#4a1d2f", "#e0607e"],
  ["#3d2a12", "#d08a3a"],
  ["#13293d", "#3e7cb1"],
  ["#1f2937", "#6b7280"],
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function coverColors(seed: string) {
  const [from, to] = PALETTES[hash(seed) % PALETTES.length];
  return { from, to };
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
  const { from, to } = coverColors(title);

  return (
    <div
      className="@container relative size-full overflow-hidden"
      style={{ background: `radial-gradient(120% 100% at 100% 0%, ${to}, ${from} 70%)` }}
    >
      {label && (
        <span className="glass-dark absolute left-4 top-4 rounded-full px-2.5 py-1 text-[11px] font-medium">{label}</span>
      )}
      {showTitle && (
        <p className="absolute inset-x-5 bottom-5 line-clamp-3 text-2xl font-semibold leading-[1.05] tracking-[-0.03em] text-white @xs:text-3xl @md:text-5xl">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
