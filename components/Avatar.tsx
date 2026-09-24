function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
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
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" style={style} className={`shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`} />;
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-ink ${className}`}
    >
      {initials(name)}
    </span>
  );
}
