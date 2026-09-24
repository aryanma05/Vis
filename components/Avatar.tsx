function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

// Faste fargepar, valgt ut fra navnet, så samme person alltid får samme farge.
const PAIRS = [
  ["#c7f9ff", "#5eb8d4"],
  ["#b9a6ff", "#6f8cff"],
  ["#9fe0a8", "#3fb6a8"],
  ["#ffc27a", "#ff8f70"],
  ["#ff9fb5", "#b9a6ff"],
  ["#a5d8ff", "#c7f9ff"],
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export default function Avatar({
  name,
  image,
  size = 32,
  className = "",
}: {
  name: string;
  image: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" style={style} className={`shrink-0 rounded-full bg-surface object-cover ${className}`} />;
  }
  const [from, to] = PAIRS[hash(name) % PAIRS.length];
  return (
    <span
      aria-hidden="true"
      style={{ ...style, background: `linear-gradient(135deg, ${from}, ${to})` }}
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-bold tracking-tight text-[#071a52] ${className}`}
    >
      {initials(name)}
    </span>
  );
}
