"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlipHorizontal2, RotateCcw, RotateCcwSquare, RotateCwSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/tabs";

// Enkel bilderedigering i nettleseren: beskjær, roter, speilvend og juster lys, kontrast
// og farger. Resultatet lagres som et nytt bilde; originalen røres ikke før skjemaet lagres.

type Rect = { x: number; y: number; w: number; h: number }; // andeler av bildet (0–1)
type Handle = "move" | "nw" | "ne" | "sw" | "se";
type Adjust = { brightness: number; contrast: number; saturation: number }; // -100 til 100

const ASPECTS = { fri: null, "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1 } as const;
type Aspect = keyof typeof ASPECTS;

const MIN = 0.06;
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0 };
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const SLIDERS: { key: keyof Adjust; label: string }[] = [
  { key: "brightness", label: "Lysstyrke" },
  { key: "contrast", label: "Kontrast" },
  { key: "saturation", label: "Metning" },
];

// Glidebryterne (-100 til 100) som faktorer for CSS-filtrene.
function factors(a: Adjust) {
  return {
    brightness: 1 + a.brightness / 200, // 0,5–1,5
    contrast: 1 + a.contrast / 200, // 0,5–1,5
    saturate: 1 + a.saturation / 100, // 0–2
  };
}

function cssFilter(a: Adjust) {
  const f = factors(a);
  return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturate})`;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

// Bildet rotert og/eller speilvendt. Beskjæringen regnes ut fra dette.
function renderBase(image: HTMLImageElement, rotation: number, flip: boolean) {
  const turned = rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = turned ? image.naturalHeight : image.naturalWidth;
  canvas.height = turned ? image.naturalWidth : image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  if (flip) context.scale(-1, 1);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvas;
}

// Samme formler som CSS-filtrene, for nettlesere der canvas ikke støtter filter (eldre Safari).
function adjustPixels(data: Uint8ClampedArray, a: Adjust) {
  const { brightness: b, contrast: c, saturate: s } = factors(a);
  const m = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
  const offset = 255 * (0.5 - 0.5 * c);
  for (let i = 0; i < data.length; i += 4) {
    let r = clamp(data[i] * b, 0, 255);
    let g = clamp(data[i + 1] * b, 0, 255);
    let bl = clamp(data[i + 2] * b, 0, 255);
    r = clamp(r * c + offset, 0, 255);
    g = clamp(g * c + offset, 0, 255);
    bl = clamp(bl * c + offset, 0, 255);
    data[i] = m[0][0] * r + m[0][1] * g + m[0][2] * bl;
    data[i + 1] = m[1][0] * r + m[1][1] * g + m[1][2] * bl;
    data[i + 2] = m[2][0] * r + m[2][1] * g + m[2][2] * bl;
  }
}

// Største ramme midt i bildet med et gitt forhold (i piksler).
function centeredRect(ratio: number, natural: { w: number; h: number }): Rect {
  let w = 1;
  let h = natural.w / (natural.h * ratio);
  if (h > 1) {
    h = 1;
    w = (ratio * natural.h) / natural.w;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export default function ImageEditor({
  src,
  onCancel,
  onSave,
}: {
  src: string;
  onCancel: () => void;
  onSave: (file: File) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"crop" | "adjust">("crop");
  const [rect, setRect] = useState<Rect>(FULL);
  const [aspect, setAspect] = useState<Aspect>("fri");
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [adjust, setAdjust] = useState<Adjust>(NO_ADJUST);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Rect } | null>(null);

  // Bilder fra andre nettsider må hentes med CORS, ellers kan de ikke tegnes om.
  useEffect(() => {
    const img = new Image();
    if (!src.startsWith("blob:") && !src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setError("Klarte ikke å åpne bildet. Last det ned og legg det til på nytt for å redigere det.");
    img.src = src;
  }, [src]);

  const base = useMemo(() => (image ? renderBase(image, rotation, flip) : null), [image, rotation, flip]);
  const natural = base ? { w: base.width, h: base.height } : { w: 1, h: 1 };

  // Forhåndsvisningen er et canvas med det roterte bildet; justeringene vises med CSS-filter.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || !base) return;
    preview.width = base.width;
    preview.height = base.height;
    preview.getContext("2d")?.drawImage(base, 0, 0);
  }, [base]);

  function chooseAspect(next: Aspect, size = natural) {
    setAspect(next);
    const ratio = ASPECTS[next];
    setRect(ratio ? centeredRect(ratio, size) : FULL);
  }

  function rotate(delta: 90 | -90) {
    setRotation((r) => (r + delta + 360) % 360);
    // Bredde og høyde bytter plass, så rammen starter på nytt.
    chooseAspect(aspect, { w: natural.h, h: natural.w });
  }

  function reset() {
    setRotation(0);
    setFlip(false);
    setAdjust(NO_ADJUST);
    setAspect("fri");
    setRect(FULL);
  }

  function startDrag(event: React.PointerEvent, handle: Handle) {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { handle, x: event.clientX, y: event.clientY, start: rect };
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (event.clientX - d.x) / box.width;
    const dy = (event.clientY - d.y) / box.height;
    const s = d.start;

    if (d.handle === "move") {
      setRect({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }

    // Hjørnet på motsatt side står stille.
    const left = d.handle === "nw" || d.handle === "sw";
    const top = d.handle === "nw" || d.handle === "ne";
    const ax = left ? s.x + s.w : s.x;
    const ay = top ? s.y + s.h : s.y;
    const px = left ? clamp(s.x + dx, 0, ax - MIN) : clamp(s.x + s.w + dx, ax + MIN, 1);
    const py = top ? clamp(s.y + dy, 0, ay - MIN) : clamp(s.y + s.h + dy, ay + MIN, 1);
    let w = Math.abs(px - ax);
    let h = Math.abs(py - ay);

    const ratio = ASPECTS[aspect];
    if (ratio) {
      const maxH = top ? ay : 1 - ay;
      h = (w * natural.w) / (natural.h * ratio);
      if (h > maxH) {
        h = maxH;
        w = (h * natural.h * ratio) / natural.w;
      }
    }
    setRect({ x: left ? ax - w : ax, y: top ? ay - h : ay, w, h });
  }

  // Tastatur: piltaster flytter rammen, Shift + piltaster endrer størrelsen (Alt gir større steg).
  function onCropKey(event: React.KeyboardEvent) {
    const step = event.altKey ? 0.1 : 0.02;
    const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[
      event.key
    ];
    if (!delta) return;
    event.preventDefault();
    const [dx, dy] = delta;
    setRect((r) => {
      if (!event.shiftKey) return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
      let w = clamp(r.w + dx, MIN, 1 - r.x);
      let h = clamp(r.h + dy, MIN, 1 - r.y);
      const ratio = ASPECTS[aspect];
      if (ratio && dx !== 0) {
        h = (w * natural.w) / (natural.h * ratio);
        if (h > 1 - r.y) {
          h = 1 - r.y;
          w = (h * natural.h * ratio) / natural.w;
        }
      } else if (ratio) {
        w = (h * natural.h * ratio) / natural.w;
        if (w > 1 - r.x) {
          w = 1 - r.x;
          h = (w * natural.w) / (natural.h * ratio);
        }
      }
      return { ...r, w, h };
    });
  }

  async function save() {
    if (!base) return;
    setSaving(true);
    try {
      const sx = Math.round(rect.x * natural.w);
      const sy = Math.round(rect.y * natural.h);
      const sw = Math.max(1, Math.round(rect.w * natural.w));
      const sh = Math.max(1, Math.round(rect.h * natural.h));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.imageSmoothingQuality = "high";

      const adjusted = adjust.brightness !== 0 || adjust.contrast !== 0 || adjust.saturation !== 0;
      const canFilter = typeof context.filter === "string";
      if (adjusted && canFilter) context.filter = cssFilter(adjust);
      context.drawImage(base, sx, sy, sw, sh, 0, 0, sw, sh);
      if (adjusted && !canFilter) {
        const pixels = context.getImageData(0, 0, sw, sh);
        adjustPixels(pixels.data, adjust);
        context.putImageData(pixels, 0, 0);
      }

      let blob = await toBlob(canvas, "image/webp", 0.92);
      if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/png");
      if (!blob) throw new Error();
      onSave(new File([blob], `bilde.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type }));
    } catch {
      setError("Dette bildet ligger på en annen nettside og kan ikke redigeres her. Last det ned og legg det til på nytt.");
      setSaving(false);
    }
  }

  const changed =
    rotation !== 0 ||
    flip ||
    adjust.brightness !== 0 ||
    adjust.contrast !== 0 ||
    adjust.saturation !== 0 ||
    rect.x !== 0 ||
    rect.y !== 0 ||
    rect.w !== 1 ||
    rect.h !== 1;

  return (
    <Dialog open onClose={onCancel} title="Rediger bildet" size="lg">
      <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-[20px] bg-black/85 p-3">
        {error ? (
          <p className="max-w-sm px-4 py-10 text-center text-sm text-white/80">{error}</p>
        ) : !base ? (
          <div className="skeleton h-64 w-full rounded-xl" />
        ) : (
          <div
            ref={boxRef}
            className="relative touch-none select-none overflow-hidden"
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            <canvas ref={previewRef} className="block max-h-[50vh] max-w-full" style={{ filter: cssFilter(adjust) }} />
            {mode === "crop" ? (
              <div
                role="group"
                tabIndex={0}
                aria-roledescription="beskjæringsramme"
                aria-label="Beskjæring. Piltastene flytter rammen, Shift og piltastene endrer størrelsen."
                aria-describedby="beskjaering-tips"
                onKeyDown={onCropKey}
                onPointerDown={(e) => startDrag(e, "move")}
                className="absolute cursor-move ring-2 ring-white outline-none focus-visible:ring-4 focus-visible:ring-sea"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
                }}
              >
                {/* Tredjedelslinjer, som i Bilder-appen. */}
                <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/35" />
                <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/35" />
                <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/35" />
                <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/35" />
                {(["nw", "ne", "sw", "se"] as const).map((h) => (
                  <span
                    key={h}
                    onPointerDown={(e) => startDrag(e, h)}
                    className={`absolute flex size-7 items-center justify-center ${h.includes("n") ? "-top-3.5" : "-bottom-3.5"} ${
                      h.includes("w") ? "-left-3.5" : "-right-3.5"
                    } ${h === "ne" || h === "sw" ? "cursor-nesw-resize" : "cursor-nwse-resize"}`}
                  >
                    <span className="size-3.5 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.4)]" />
                  </span>
                ))}
              </div>
            ) : (
              // Under justering vises bare den beskjærte delen klart.
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.7)",
                }}
              />
            )}
          </div>
        )}
      </div>
      {mode === "crop" && base && !error && (
        <p id="beskjaering-tips" className="mt-2 hidden text-xs text-mist md:block">
          Dra i rammen eller hjørnene. Med tastatur: velg rammen, bruk piltastene for å flytte og Shift + piltastene for å endre størrelsen.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Verktøy"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "crop", label: "Beskjær og roter" },
            { value: "adjust", label: "Juster" },
          ]}
        />
        {changed && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-4" /> Tilbakestill
          </Button>
        )}
      </div>

      {mode === "crop" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Segmented
            label="Format"
            size="sm"
            value={aspect}
            onChange={(next) => chooseAspect(next)}
            options={(Object.keys(ASPECTS) as Aspect[]).map((key) => ({ value: key, label: key === "fri" ? "Fritt" : key }))}
          />
          <div className="ml-auto flex gap-1.5">
            <Button variant="secondary" size="icon-sm" aria-label="Roter mot venstre" title="Roter mot venstre" onClick={() => rotate(-90)} disabled={!base}>
              <RotateCcwSquare className="size-4" />
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label="Roter mot høyre" title="Roter mot høyre" onClick={() => rotate(90)} disabled={!base}>
              <RotateCwSquare className="size-4" />
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label="Speilvend" title="Speilvend" aria-pressed={flip} onClick={() => setFlip((f) => !f)} disabled={!base}>
              <FlipHorizontal2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {SLIDERS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-fg">{label}</span>
                <span className="tabular-nums text-mist">{adjust[key] > 0 ? `+${adjust[key]}` : adjust[key]}</span>
              </span>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={adjust[key]}
                onChange={(e) => setAdjust((a) => ({ ...a, [key]: Number(e.target.value) }))}
                onDoubleClick={() => setAdjust((a) => ({ ...a, [key]: 0 }))}
                className="mt-2 w-full accent-sea"
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
        <Button onClick={save} loading={saving} disabled={!base || Boolean(error) || !changed}>
          Bruk
        </Button>
      </div>
    </Dialog>
  );
}
