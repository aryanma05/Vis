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

// Dempede fargepar (som monogrammene i Kontakter), valgt ut fra navnet, så samme
// person alltid får samme farge.
const PAIRS = [
  ["#a7b0c0", "#7c8698"],
  ["#8fb3d9", "#5d86b8"],
  ["#9cc5b0", "#6a9c84"],
  ["#d3ae8b", "#b0845f"],
  ["#c6a2c9", "#9b74a0"],
  ["#d49b9b", "#b06f6f"],
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
      style={{ ...style, background: `linear-gradient(180deg, ${from}, ${to})` }}
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight text-white ${className}`}
    >
      {initials(name)}
    </span>
  );
}
