import { AtSign, Globe, Link2 } from "lucide-react";
import { DribbbleMark, FigmaMark, GithubMark, InstagramMark, LinkedinMark, XMark, YoutubeMark } from "@/components/icons";

// Ikon for en lenke ut fra adressen (GitHub, LinkedIn osv.).
export function linkIcon(url: string): React.ComponentType<{ className?: string }> {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  if (host.endsWith("github.com")) return GithubMark;
  if (host.endsWith("linkedin.com")) return LinkedinMark;
  if (host.endsWith("dribbble.com")) return DribbbleMark;
  if (host.endsWith("instagram.com")) return InstagramMark;
  if (host.endsWith("youtube.com") || host === "youtu.be") return YoutubeMark;
  if (host === "x.com" || host.endsWith("twitter.com")) return XMark;
  if (host.endsWith("figma.com")) return FigmaMark;
  if (host.endsWith("behance.net") || host.endsWith("medium.com") || host.endsWith("bsky.app") || host.includes("mastodon")) return AtSign;
  if (host) return Globe;
  return Link2;
}

export function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
