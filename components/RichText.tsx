import Link from "next/link";
import { segment } from "@/lib/mentions";

// Vanlig tekst der @omtaler blir lenker til profiler og nettadresser blir klikkbare.
// `known` er brukernavnene som finnes; andre @ord står som vanlig tekst.
export default function RichText({ text, known, className = "" }: { text: string; known?: string[]; className?: string }) {
  const existing = known ? new Set(known.map((k) => k.toLowerCase())) : null;
  return (
    <p className={`whitespace-pre-line break-words ${className}`}>
      {segment(text).map((s, i) => {
        if (s.type === "text") return <span key={i}>{s.value}</span>;
        if (s.type === "link") {
          return (
            <a key={i} href={s.url} target="_blank" rel="noreferrer nofollow ugc" className="text-ice underline decoration-ice/40 underline-offset-2 hover:decoration-ice">
              {s.url.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          );
        }
        if (existing && !existing.has(s.username.toLowerCase())) return <span key={i}>@{s.username}</span>;
        return (
          <Link key={i} href={`/@${s.username.toLowerCase()}`} className="font-semibold text-ice hover:underline">
            @{s.username}
          </Link>
        );
      })}
    </p>
  );
}
