import Link from "next/link";

type Tag = { slug: string; name: string; count?: number };

// Teknologier som lenker til søkesiden. `active` markerer valgt filter.
export default function TagLinks({ tags, active }: { tags: Tag[]; active?: string | null }) {
  if (tags.length === 0) return null;
  return (
    <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {tags.map((t) => {
        const isActive = t.slug === active;
        return (
          <Link
            key={t.slug}
            href={isActive ? "/sok" : `/sok?tag=${encodeURIComponent(t.slug)}`}
            className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-xs transition ${
              isActive ? "border-primary bg-primary text-ink" : "border-line text-mist hover:border-mist/60 hover:text-fg"
            }`}
          >
            {t.name}
            {t.count !== undefined && <span className={`ml-2 ${isActive ? "text-ink/60" : "text-mist/50"}`}>{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
