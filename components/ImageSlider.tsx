"use client";

import { useState } from "react";

type Image = { id: string; url: string; alt: string | null };

export default function ImageSlider({ images, title }: { images: Image[]; title: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  const current = images[index];
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#174B76] bg-[#0A245E]">
      <div className="relative aspect-video bg-black/30">
        {/* Bildene kan ligge hos mange ulike verter (README-er), derfor vanlig <img>. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.alt ?? `${title} – bilde ${index + 1}`} className="h-full w-full object-contain" />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Forrige bilde"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white backdrop-blur transition hover:bg-black/70"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Neste bilde"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white backdrop-blur transition hover:bg-black/70"
            >
              →
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-2 py-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Vis bilde ${i + 1}`}
              className={`h-2 w-2 rounded-full transition ${i === index ? "bg-[#C7F9FF]" : "bg-[#174B76] hover:bg-[#B8D8E3]"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
