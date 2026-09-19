"use client";

import { useCallback, useEffect, useState } from "react";

type Image = { id: string; url: string; alt: string | null };

export default function ImageSlider({ images, title }: { images: Image[]; title: string }) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go]);

  if (count === 0) return null;
  const current = images[index];

  return (
    <div>
      <div className="group relative overflow-hidden rounded-2xl border border-line bg-black/30">
        <div className="relative aspect-[16/10]">
          {/* Bildene kan ligge hos mange ulike verter (README-er), derfor vanlig <img>. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.id}
            src={current.url}
            alt={current.alt ?? `${title} – bilde ${index + 1}`}
            className="absolute inset-0 size-full animate-[fade_300ms_ease-out] object-contain"
          />
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Forrige bilde"
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 backdrop-blur transition hover:bg-ink focus-visible:opacity-100 group-hover:opacity-100"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Neste bilde"
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 backdrop-blur transition hover:bg-ink focus-visible:opacity-100 group-hover:opacity-100"
            >
              →
            </button>
            <span className="absolute bottom-4 right-4 rounded-md bg-ink/70 px-2 py-1 font-mono text-xs text-mist backdrop-blur">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Vis bilde ${i + 1}`}
              aria-current={i === index}
              className={`relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-lg border transition ${
                i === index ? "border-ice" : "border-line opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
