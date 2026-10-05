"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, MoveVertical } from "lucide-react";
import { uploadBannerAction } from "@/app/actions/profile";
import Avatar from "@/components/Avatar";
import Pet from "@/components/pet/Pet";
import BannerArtSvg from "@/components/profile/banner-art";
import ProfileBanner from "@/components/profile/ProfileBanner";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { prepareImage } from "@/lib/prepare-image";
import {
  BANNER_ART_KEYS,
  BANNER_ARTS,
  BANNER_COLORS,
  BANNER_GRADIENT_KEYS,
  BANNER_GRADIENTS,
  BANNER_PATTERN_KEYS,
  BANNER_PATTERNS,
  type BannerConfig,
  type PetConfig,
} from "@/lib/profile-style";

type Kind = "standard" | "farge" | "monster" | "bilder" | "eget";

const kindOf = (b: BannerConfig | null): Kind =>
  !b || b.type === "accent" ? "standard" : b.type === "pattern" ? "monster" : b.type === "art" ? "bilder" : b.type === "image" ? "eget" : "farge";

// Et valg i rutenettet: en liten forhåndsvisning med ramme når den er valgt.
function Choice({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={label} className="group text-left">
      <span
        className={`relative block aspect-[4/1] overflow-hidden rounded-xl transition ${on ? "ring-2 ring-sea ring-offset-2 ring-offset-ink" : "ring-1 ring-line group-hover:ring-mist/50"}`}
      >
        {children}
        {on && (
          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-sea text-white">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="mt-1.5 block truncate text-xs text-mist group-hover:text-fg">{label}</span>
    </button>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const custom = /^#[0-9a-f]{6}$/i.test(value) && !BANNER_COLORS.includes(value as (typeof BANNER_COLORS)[number]);
  return (
    <div role="radiogroup" aria-label="Farge" className="flex flex-wrap items-center gap-2">
      {BANNER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={`size-8 rounded-full ring-1 ring-line transition hover:scale-110 ${value === color ? "ring-2 ring-sea ring-offset-2 ring-offset-ink" : ""}`}
          style={{ background: color }}
        />
      ))}
      <label
        className={`relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-line transition hover:scale-110 ${custom ? "ring-2 ring-sea ring-offset-2 ring-offset-ink" : ""}`}
        style={{ background: custom ? value : "conic-gradient(#ff6b6b, #ffd43b, #51cf66, #4dabf7, #845ef7, #ff6b6b)" }}
        title="Egen farge"
      >
        <input
          type="color"
          value={custom ? value : "#4b93ff"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Egen farge"
        />
      </label>
    </div>
  );
}

export default function BannerEditor({
  value,
  onChange,
  onUploaded,
  accent,
  name,
  avatar,
  pet,
}: {
  value: BannerConfig | null;
  onChange: (banner: BannerConfig | null) => void;
  // Et opplastet bilde er allerede lagret på serveren.
  onUploaded: (banner: BannerConfig) => void;
  accent: string;
  name: string;
  avatar: string | null;
  pet: PetConfig | null;
}) {
  const [kind, setKind] = useState<Kind>(kindOf(value));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ y: number; start: number; height: number } | null>(null);

  const color = value && (value.type === "color" || value.type === "pattern") ? value.color : BANNER_COLORS[1];
  const pattern = value?.type === "pattern" ? value.pattern : "prikker";
  const image = value?.type === "image" ? value : null;

  async function upload(file: File) {
    setUploading(true);
    try {
      const prepared = await prepareImage(file, { maxSide: 2400 });
      const fd = new FormData();
      fd.append("banner", prepared);
      const result = await uploadBannerAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onUploaded(result.data.banner);
      setKind("eget");
      toast.success("Bannerbildet er lastet opp", { description: "Dra i bildet for å velge hvilken del som vises." });
    } catch (e) {
      toast.error((e as Error).message || "Opplastingen feilet. Prøv igjen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* Forhåndsvisning, omtrent som på profilen. Bildet kan dras opp og ned. */}
      <div className="relative pb-8">
        <div
          className={`glass-card relative h-32 overflow-hidden rounded-[22px] sm:h-40 ${image ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
          onPointerDown={(e) => {
            if (!image) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { y: e.clientY, start: image.y, height: e.currentTarget.getBoundingClientRect().height };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || !image) return;
            const y = Math.min(100, Math.max(0, d.start - ((e.clientY - d.y) / d.height) * 100));
            onChange({ ...image, y: Math.round(y) });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <ProfileBanner banner={value} accent={accent} uid="banner-preview" />
          <span className="glass-rim" />
          {image && (
            <span className="glass-dark pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
              <MoveVertical className="size-3.5" /> Dra for å flytte
            </span>
          )}
        </div>
        <Avatar name={name || "?"} image={avatar} size={64} className="absolute bottom-0 left-5 ring-4 ring-ink" />
        {pet && (
          <div className="absolute -bottom-1 right-5">
            <Pet pet={pet} size={72} />
          </div>
        )}
      </div>

      <div className="mt-6">
        <Tabs
          label="Type banner"
          size="sm"
          active={kind}
          onSelect={(k) => setKind(k as Kind)}
          items={[
            { key: "standard", label: "Standard" },
            { key: "farge", label: "Farge" },
            { key: "monster", label: "Mønster" },
            { key: "bilder", label: "Illustrasjoner" },
            { key: "eget", label: "Eget bilde" },
          ]}
        />
      </div>

      <div className="mt-5">
        {kind === "standard" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-56">
              <Choice on={!value || value.type === "accent"} onClick={() => onChange({ type: "accent" })} label="Aksentfargen din">
                <ProfileBanner banner={null} accent={accent} uid="banner-std" />
              </Choice>
            </div>
            <p className="max-w-xs text-sm text-mist">Lys og et rolig rutenett i aksentfargen du velger lenger ned.</p>
          </div>
        )}

        {kind === "farge" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BANNER_GRADIENT_KEYS.map((key) => (
                <Choice
                  key={key}
                  on={value?.type === "gradient" && value.gradient === key}
                  onClick={() => onChange({ type: "gradient", gradient: key })}
                  label={BANNER_GRADIENTS[key].label}
                >
                  <ProfileBanner banner={{ type: "gradient", gradient: key }} accent={accent} />
                </Choice>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-fg">Ensfarget</p>
              <Swatches value={value?.type === "color" ? value.color : ""} onChange={(c) => onChange({ type: "color", color: c })} />
            </div>
          </div>
        )}

        {kind === "monster" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BANNER_PATTERN_KEYS.map((key) => (
                <Choice
                  key={key}
                  on={value?.type === "pattern" && value.pattern === key}
                  onClick={() => onChange({ type: "pattern", pattern: key, color })}
                  label={BANNER_PATTERNS[key]}
                >
                  <ProfileBanner banner={{ type: "pattern", pattern: key, color }} accent={accent} uid={`pat-${key}`} />
                </Choice>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-fg">Farge på mønsteret</p>
              <Swatches value={color} onChange={(c) => onChange({ type: "pattern", pattern, color: c })} />
            </div>
          </div>
        )}

        {kind === "bilder" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BANNER_ART_KEYS.map((key) => (
              <Choice key={key} on={value?.type === "art" && value.art === key} onClick={() => onChange({ type: "art", art: key })} label={BANNER_ARTS[key]}>
                <BannerArtSvg art={key} uid={`art-${key}`} />
              </Choice>
            ))}
          </div>
        )}

        {kind === "eget" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
                <ImagePlus className="size-4" /> {image ? "Bytt bilde" : "Last opp bilde"}
              </Button>
              <p className="text-sm text-mist">Bredt bilde, gjerne 1600 × 400 piksler eller større.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.target.value = "";
                }}
              />
            </div>
            {image && (
              <label className="block max-w-sm">
                <span className="flex justify-between text-sm">
                  <span className="font-medium text-fg">Utsnitt</span>
                  <span className="text-mist">{image.y < 34 ? "Toppen" : image.y > 66 ? "Bunnen" : "Midten"}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={image.y}
                  onChange={(e) => onChange({ ...image, y: Number(e.target.value) })}
                  className="mt-2 w-full accent-sea"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
