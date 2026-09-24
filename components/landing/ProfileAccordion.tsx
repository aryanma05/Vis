"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import Avatar from "@/components/Avatar";
import "./ProfileAccordion.css";

export type AccordionProfile = {
  href: string;
  name: string;
  username: string;
  headline: string | null;
  location: string | null;
  avatar: string | null;
  image: string | null;
  tags: string[];
  accent: string;
  stats: string;
};

// Profiler som paneler på rad. Ett panel er åpent om gangen og viser visittkortet;
// de andre er smale, grå og litt vridd. Hover, fokus eller trykk åpner et panel.
// Bygget etter Accordion Gallery fra React Bits, med CSS-overganger i stedet for GSAP.
export default function ProfileAccordion({
  items,
  defaultIndex = 1,
  expandRatio = 0.46,
  tilt = 7,
  parallax = 0.5,
}: {
  items: AccordionProfile[];
  defaultIndex?: number;
  expandRatio?: number;
  tilt?: number;
  parallax?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const count = items.length;
  const [active, setActive] = useState(Math.min(Math.max(defaultIndex, 0), count - 1));
  const [mediaSize, setMediaSize] = useState(360);
  const [vertical, setVertical] = useState(false);
  const [finePointer, setFinePointer] = useState(true);

  const r = Math.min(Math.max(expandRatio, 0.2), 0.9);
  const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const isVertical = window.matchMedia("(max-width: 639px)").matches;
      setVertical(isVertical);
      const rect = el.getBoundingClientRect();
      const total = isVertical ? rect.height : rect.width;
      const usable = Math.max(total - 10 * (count - 1), 120);
      setMediaSize(Math.max(160, usable * r * 1.22));
    };
    measure();
    setFinePointer(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count, r]);

  if (count === 0) return null;

  return (
    <div
      ref={rootRef}
      role="list"
      aria-label="Profiler på Vis"
      className="profile-accordion"
      style={{ "--pa-media": `${mediaSize}px` } as CSSProperties}
    >
      {items.map((item, i) => {
        const isActive = i === active;
        const rot = isActive ? 0 : i < active ? tilt : -tilt;
        const drift = Math.max(-1.5, Math.min(1.5, active - i)) * parallax * mediaSize * 0.06;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="listitem"
            aria-current={isActive ? "true" : undefined}
            aria-label={`${item.name}${item.headline ? `, ${item.headline}` : ""}`}
            className={`pa-panel ${isActive ? "is-active" : ""}`}
            style={
              {
                flexGrow: isActive ? grow : 1,
                transform: vertical ? "none" : `rotateY(${rot}deg)`,
                "--pa-accent": item.accent,
              } as CSSProperties
            }
            onMouseEnter={() => finePointer && setActive(i)}
            onFocus={() => setActive(i)}
            onClick={(e) => {
              if (!isActive) {
                e.preventDefault();
                setActive(i);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                const next = (i + 1) % count;
                setActive(next);
                (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                const prev = (i - 1 + count) % count;
                setActive(prev);
                (e.currentTarget.parentElement?.children[prev] as HTMLElement | undefined)?.focus();
              }
            }}
          >
            <span className="pa-frame">
              <span
                className="pa-media"
                style={{ transform: vertical ? "none" : `translate(-50%, -50%) translateX(${isActive ? 0 : drift}px)` }}
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" draggable={false} loading={i < 3 ? "eager" : "lazy"} />
                ) : (
                  <span className="pa-fallback" style={{ background: `linear-gradient(150deg, ${item.accent}, #071a52 70%)` }} />
                )}
              </span>
              <span className="pa-overlay" aria-hidden="true" />
            </span>

            {/* Smalt panel: navnet på høykant. */}
            <span className="pa-collapsed" aria-hidden="true">
              <Avatar name={item.name} image={item.avatar} size={30} className="ring-2 ring-white/20" />
              <span className="pa-vertical">{item.name}</span>
            </span>

            {/* Åpent panel: visittkortet. */}
            <span className="pa-card" aria-hidden={!isActive}>
              <span className="pa-stat">{item.stats}</span>
              <span className="pa-body">
                <span className="pa-bar" />
                <span className="flex items-center gap-3">
                  <Avatar name={item.name} image={item.avatar} size={48} className="ring-2 ring-white/25" />
                  <span className="min-w-0">
                    <span className="block truncate text-xl font-bold tracking-tight text-white md:text-2xl">{item.name}</span>
                    <span className="block truncate text-sm text-white/75">@{item.username}</span>
                  </span>
                </span>
                {item.headline && <span className="mt-3 line-clamp-2 block max-w-md text-[15px] leading-6 text-white/90">{item.headline}</span>}
                <span className="mt-3 flex flex-wrap items-center gap-1.5">
                  {item.location && (
                    <span className="mr-1 inline-flex items-center gap-1 text-[13px] text-white/75">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {item.location}
                    </span>
                  )}
                  {item.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-md bg-white/12 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur">
                      {t}
                    </span>
                  ))}
                </span>
                <span className="pa-cta">
                  Se profilen <ArrowUpRight className="size-4" aria-hidden="true" />
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
