import { ArrowUpRight, PlayCircle } from "lucide-react";

// Gjør en video- eller prototypelenke om til en innebygd spiller. Ukjente lenker
// vises som et vanlig lenkekort.
export function embedUrl(url: string): { src: string; kind: "video" | "prototype"; ratio: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
    return id ? { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`, kind: "video", ratio: "16/9" } : null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`, kind: "video", ratio: "16/9" } : null;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? { src: `https://player.vimeo.com/video/${id}?dnt=1`, kind: "video", ratio: "16/9" } : null;
  }
  if (host === "loom.com") {
    const id = u.pathname.split("/").filter(Boolean)[1];
    return id ? { src: `https://www.loom.com/embed/${encodeURIComponent(id)}`, kind: "video", ratio: "16/9" } : null;
  }
  if (host === "figma.com" && /^\/(file|design|proto)\//.test(u.pathname)) {
    return { src: `https://www.figma.com/embed?embed_host=vis&url=${encodeURIComponent(url)}`, kind: "prototype", ratio: "16/10" };
  }
  return null;
}

export default function VideoEmbed({ url, title }: { url: string; title: string }) {
  const embed = embedUrl(url);
  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-4 rounded-2xl border border-line p-4 transition hover:border-ice/50 hover:bg-surface"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-ice">
          <PlayCircle className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Se video eller prototype</span>
          <span className="block truncate text-sm text-mist">{url.replace(/^https?:\/\//, "")}</span>
        </span>
        <ArrowUpRight className="size-4 text-mist transition group-hover:text-ice" />
      </a>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-line md:rounded-3xl" style={{ aspectRatio: embed.ratio }}>
      <iframe
        src={embed.src}
        title={`${embed.kind === "video" ? "Video" : "Prototype"}: ${title}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="size-full border-0"
      />
    </div>
  );
}
