"use client";

import { ArrowRight } from "lucide-react";
import GradientWaves from "@/components/GradientWaves";
import { useTheme } from "@/components/ThemeProvider";
import { ButtonLink } from "@/components/ui/button";

// Bølgene får farger som passer temaet.
const WAVE_COLORS = {
  midnight: { horizon: "#071A52", wave: "#086788", crest: "#C7F9FF" },
  dark: { horizon: "#050816", wave: "#0E7490", crest: "#7DD3FC" },
  light: { horizon: "#DCE6F5", wave: "#9EC5D8", crest: "#FFFFFF" },
} as const;

// Tekstanimasjonene er CSS (.line-up, .fade-up), så overskriften vises uten å
// vente på JavaScript.
export default function HomeHero({ stats }: { stats: { people: number; projects: number; tags: number } }) {
  const { theme } = useTheme();
  const colors = WAVE_COLORS[theme];

  return (
    <section className="relative isolate overflow-hidden md:min-h-[92vh]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <GradientWaves
          horizonColor={colors.horizon}
          waveColor={colors.wave}
          crestColor={colors.crest}
          speed={0.35}
          amplitude={2.5}
          waveScale={0.6}
          waveRatio={0.9}
          swell={35}
          turbulence={20}
          tilt={1.11}
          zoom={1}
          height={5.5}
          fogDepth={15}
          detail="medium"
          brightness={1}
          opacity={1}
          mouseInteraction
          parallaxStrength={0.5}
          grain
          grainIntensity={0.05}
          className="h-full w-full"
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col justify-center px-5 pb-20 pt-16 md:min-h-[92vh] md:pl-28 md:pr-10 md:pt-24">
       
         

        <h1 className="mt-7 display text-[clamp(3.4rem,10.5vw,9.5rem)] text-fg">
          <span className="block overflow-hidden pb-[0.04em]">
            <span className="line-up block" style={{ animationDelay: "60ms" }}>
              Vis deg selv.
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.08em]">
            <span className="line-up block" style={{ animationDelay: "170ms" }}>
              Vis <span className="serif-accent font-normal text-ice">dine</span> verk.
            </span>
          </span>
        </h1>

        <div className="fade-up mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" style={{ animationDelay: "350ms" }}>
          <p className="max-w-xl text-lg leading-8 text-fg/80 md:text-xl md:leading-9">
            Et visuelt visittkort, en ryddig CV og prosjektene dine – samlet på én lenke. Importer CV-en, hent prosjekter fra
            GitHub, og bli oppdaget av folk som ser etter nettopp deg.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/register" size="lg">
              Lag profilen din <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/sok" size="lg" variant="secondary" className="bg-surface/70 backdrop-blur">
              Utforsk prosjekter
            </ButtonLink>
          </div>
        </div>

        <dl className="fade-up mt-14 flex flex-wrap gap-x-10 gap-y-4 border-t border-line/70 pt-6" style={{ animationDelay: "550ms" }}>
          {[
            [stats.people, "profiler"],
            [stats.projects, "prosjekter"],
            [stats.tags, "teknologier"],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums tracking-tight text-fg">{value}</dd>
              <span className="text-sm text-mist" aria-hidden="true">
                {label}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
