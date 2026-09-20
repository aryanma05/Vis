"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import GradientWaves from "@/components/GradientWaves";
import HeroPreviewParallax from "@/components/HeroPreviewParallax";
import Sidebar from "@/components/Sidebar";
import { useTheme } from "@/components/ThemeProvider";
import MutedText from "@/components/MutedText";

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();

  const mainThemeClasses =
    theme === "midnight"
      ? "bg-[#071A52] text-white"
      : theme === "dark"
      ? "bg-[#050816] text-[#E5F0FF]"
      : "bg-[#F5F7FB] text-[#071A52]";

  const brandAccentClasses =
    theme === "light" ? "text-[#086788]" : "text-[#C7F9FF]";

  const primaryButtonClasses =
    theme === "light"
      ? "bg-[#071A52] text-white hover:bg-[#0A245E]"
      : "bg-[#C7F9FF] text-[#071A52] hover:bg-white";

  return (
    <main
      className={`relative min-h-screen ${mainThemeClasses} transition-colors duration-300`}
    >
      <div className="pointer-events-none absolute inset-0">
        <GradientWaves
          horizonColor="#071A52"
          waveColor="#086788"
          crestColor="#C7F9FF"
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
          className="w-full h-full"
        />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <Sidebar />

        {/* Hero + parallax-preview */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 md:pl-28">
          <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-2">
            {/* Tekst / CTA */}
            <div className="flex flex-col justify-center">
              <p className={`text-xs font-medium uppercase tracking-[0.2em] ${brandAccentClasses}`}>
                vis
              </p>

              <h1 className="mt-4 text-3xl font-bold tracking-tight lg:text-4xl">
                Vis deg selv.
                <br />
                Vis dine verk.
              </h1>

              <MutedText className="mt-4 text-sm leading-7">
                vis er en visuell porteføljeplattform for utviklere, designere
                og digitale skapere. Samle CV, prosjekter og din digitale
                identitet i én moderne profil.
              </MutedText>

              <div className="mt-6 flex flex-wrap gap-3">
                <motion.button
                  onClick={() => router.push("/register")}
                  className={`rounded-lg px-5 py-3 text-sm font-semibold shadow-md shadow-black/30 transition ${primaryButtonClasses}`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                >
                  Kom i gang
                </motion.button>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <HeroPreviewParallax />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}