"use client";

import { useCallback, useEffect, useState } from "react";

type Image = { id: string; url: string; alt: string | null };

// Alle bildene i full bredde, under hverandre, i sin egen form (ingen beskjæring).
// Klikk på et bilde for å se det i fullskjerm og bla med piltastene.
export default function ProjectGallery({ images, title }: { images: Image[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const count = images.length;
  const alt = (img: Image, i: number) => img.alt ?? `${title} – bilde ${i + 1} av ${count}`;

  const go = useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );

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

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Vis bilde ${i + 1} i fullskjerm`}
            className="group block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-black/30 md:rounded-3xl"
          >
            {/* Bildene kan ligge hos mange ulike verter (README-er), derfor vanlig <img>. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={alt(img, i)}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              className="mx-auto h-auto max-h-[88vh] w-full object-contain transition duration-500 group-hover:scale-[1.01]"
            />
          </button>
        ))}
      </div>

      {current && open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} – bilde ${open + 1} av ${count}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-[fade_200ms_ease-out]"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.id}
            src={current.url}
            alt={alt(current, open)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[94vw] object-contain"
          />

          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Lukk"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
          >
            ✕
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="Forrige bilde"
                className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20 md:left-6"
              >
                ←
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="Neste bilde"
                className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20 md:right-6"
              >
                →
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white/80">
                {open + 1} / {count}
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
