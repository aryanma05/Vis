"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

type Image = { id: string; url: string; alt: string | null };

// Bildene som en «bento»: det første stort, de neste mindre ved siden av. Klikk
// åpner fullskjerm der man kan bla med piltaster, knapper eller sveip.
export default function ProjectGallery({ images, title }: { images: Image[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const count = images.length;
  const touchX = useRef<number | null>(null);
  const alt = (img: Image, i: number) => img.alt ?? `${title} – bilde ${i + 1} av ${count}`;

  const go = useCallback((delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count)), [count]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, go]);

  if (count === 0) return null;
  const current = open === null ? null : images[open];

  const tile = (img: Image, i: number, className: string, eager = false) => (
    <button
      key={img.id}
      type="button"
      onClick={() => setOpen(i)}
      aria-label={`Vis bilde ${i + 1} i fullskjerm`}
      className={`group relative block cursor-zoom-in overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 md:rounded-3xl ${className}`}
    >
      {/* Bildene kan ligge hos mange ulike verter (README-er), derfor vanlig <img>. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.url}
        alt={alt(img, i)}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        className="size-full object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.02]"
      />
      <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
        <Expand className="size-4" aria-hidden="true" />
      </span>
    </button>
  );

  return (
    <>
      {count === 1 ? (
        <div className="aspect-[16/10] max-h-[80vh] w-full">{tile(images[0], 0, "size-full", true)}</div>
      ) : count === 2 ? (
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr] md:gap-4">
          {tile(images[0], 0, "aspect-[16/10] w-full", true)}
          {tile(images[1], 1, "aspect-[16/10] w-full md:aspect-auto md:h-full")}
        </div>
      ) : (
        <div className="grid gap-3 md:h-[min(72vh,640px)] md:grid-cols-[1.7fr_1fr] md:grid-rows-2 md:gap-4">
          {tile(images[0], 0, "aspect-[16/10] w-full md:row-span-2 md:aspect-auto md:h-full", true)}
          {tile(images[1], 1, "aspect-[16/10] w-full md:aspect-auto md:h-full")}
          <div className="relative">
            {tile(images[2], 2, "aspect-[16/10] w-full md:aspect-auto md:h-full")}
            {count > 3 && (
              <button
                type="button"
                onClick={() => setOpen(3)}
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 text-2xl font-bold text-white backdrop-blur-[2px] transition hover:bg-black/45 md:rounded-3xl"
              >
                +{count - 3}
                <span className="sr-only"> bilder til</span>
              </button>
            )}
          </div>
        </div>
      )}

      {current && open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} – bilde ${open + 1} av ${count}`}
          className="fixed inset-0 z-[80] flex animate-[fade_200ms_ease-out] flex-col bg-[#02061a]/95 backdrop-blur-sm"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 text-sm text-white/80">
            <span className="font-mono text-xs">
              {open + 1} / {count}
            </span>
            <span className="hidden max-w-[50%] truncate md:block">{alt(current, open)}</span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Lukk"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.id}
              src={current.url}
              alt={alt(current, open)}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full animate-[fade_250ms_ease-out] rounded-xl object-contain"
            />
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(-1);
                  }}
                  aria-label="Forrige bilde"
                  className="absolute left-3 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:left-6"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(1);
                  }}
                  aria-label="Neste bilde"
                  className="absolute right-3 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:right-6"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
          {count > 1 && (
            <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-4 pb-5" onClick={(e) => e.stopPropagation()}>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={`Bilde ${i + 1}`}
                  aria-current={i === open}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === open ? "ring-white" : "opacity-50 ring-transparent hover:opacity-90"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
