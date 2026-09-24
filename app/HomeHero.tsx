"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import GradientWaves from "@/components/GradientWaves";
import HeroPreviewParallax from "@/components/HeroPreviewParallax";
import MutedText from "@/components/MutedText";
import { useTheme } from "@/components/ThemeProvider";
import { ArrowIcon } from "@/components/icons";

// Bølgene får farger som passer temaet.
const WAVE_COLORS = {
  midnight: { horizon: "#071A52", wave: "#086788", crest: "#C7F9FF" },
  dark: { horizon: "#050816", wave: "#0E7490", crest: "#7DD3FC" },
  light: { horizon: "#DCE6F5", wave: "#9EC5D8", crest: "#FFFFFF" },
} as const;

export default function HomeHero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { theme } = useTheme();
  const colors = WAVE_COLORS[theme];

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <GradientWaves
          horizonColor={colors.horizon}
          waveColor={colors.wave}
          crestColor={colors.crest}
          speed={0.4}
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
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16 md:pl-28">
        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.25em] text-ice">vis</p>

            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Vis deg selv.
              <br />
              Vis dine verk.
            </h1>

            <MutedText className="mt-5 max-w-lg text-base leading-8">
              vis er en visuell porteføljeplattform for utviklere, designere og digitale skapere. Samle CV,
              prosjekter og din digitale identitet i én moderne profil.
            </MutedText>

            <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:flex-row">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/sok"
                  className="group inline-flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-on-primary shadow-lg shadow-black/30 transition hover:opacity-90 sm:w-auto"
                >
                  Utforsk prosjekter
                  <ArrowIcon className="h-5 w-5 transition group-hover:translate-x-1" />
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href={isLoggedIn ? "/ny" : "/register"}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface/70 px-7 py-4 text-lg font-medium text-fg backdrop-blur transition hover:border-ice sm:w-auto"
                >
                  {isLoggedIn ? "Del prosjekt" : "Kom i gang"}
                </Link>
              </motion.div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <HeroPreviewParallax />
          </div>
        </div>
      </div>
    </section>
  );
}
