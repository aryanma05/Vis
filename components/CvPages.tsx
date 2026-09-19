"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { DownloadIcon } from "@/components/icons";

type Page = { url: string; width: number; height: number };

// CV-sidene som papirark. Klikk åpner en fullskjermvisning med zoom.
export default function CvPages({ pages, fileUrl, name }: { pages: Page[]; fileUrl: string; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const close = useCallback(() => {
    setOpen(null);
    setZoomed(false);
  }, []);
  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      setOpen((i) => (i === null ? i : Math.min(Math.max(i + delta, 0), pages.length - 1)));
    },
    [pages.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, go]);

  return (
    <>
      <div className="space-y-8">
        {pages.map((page, i) => (
          <button
            key={page.url}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[3px] bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-black/10 transition duration-500 hover:-translate-y-1"
            aria-label={`Åpne side ${i + 1} av CV-en`}
          >
            <Image
              src={page.url}
              alt={`CV-en til ${name}, side ${i + 1}`}
              width={page.width}
              height={page.height}
              sizes="(min-width: 1280px) 820px, (min-width: 1024px) 60vw, 100vw"
              priority={i === 0}
              className="h-auto w-full"
            />
            <span className="pointer-events-none absolute bottom-4 right-4 rounded-md bg-ink/80 px-2.5 py-1 font-mono text-[11px] text-mist opacity-0 backdrop-blur transition group-hover:opacity-100">
              Klikk for å zoome
            </span>
          </button>
        ))}
      </div>

      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label="CV" className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-sm">
            <span className="font-mono text-xs text-mist">
              Side {open + 1} av {pages.length}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setZoomed((z) => !z)} className="rounded-lg px-3 py-1.5 text-mist hover:bg-white/5 hover:text-white">
                {zoomed ? "Tilpass skjermen" : "Full størrelse"}
              </button>
              <a
                href={fileUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-mist hover:bg-white/5 hover:text-white"
              >
                <DownloadIcon /> Last ned
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Lukk"
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg text-xl text-mist hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-auto" onClick={(e) => e.target === e.currentTarget && close()}>
            {/* Full oppløsning i fullskjerm. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pages[open].url}
              alt={`CV-en til ${name}, side ${open + 1}`}
              onClick={() => setZoomed((z) => !z)}
              className={
                zoomed
                  ? "mx-auto my-6 max-w-none cursor-zoom-out bg-white"
                  : "mx-auto my-6 max-h-[calc(100vh-7rem)] w-auto max-w-[min(100%,1000px)] cursor-zoom-in bg-white object-contain"
              }
              style={zoomed ? { width: Math.min(pages[open].width, 2400) } : undefined}
            />
          </div>

          {pages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={open === 0}
                aria-label="Forrige side"
                className="absolute left-4 top-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-white disabled:opacity-30"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={open === pages.length - 1}
                aria-label="Neste side"
                className="absolute right-4 top-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-white disabled:opacity-30"
              >
                →
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
