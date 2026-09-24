"use client";

import React from "react";
import {
  MouseParallaxContainer,
  MouseParallaxChild,
} from "react-parallax-mouse";
import { useTheme } from "@/components/ThemeProvider";
import MutedText from "@/components/MutedText";

export default function HeroPreviewParallax() {
  const { theme } = useTheme();

  const panelBg =
    theme === "midnight"
      ? "bg-[#0A245E]/85"
      : theme === "dark"
      ? "bg-[#050816]/90"
      : "bg-[#FFFFFF]/95";

  const panelBorder =
    theme === "midnight"
      ? "border-[#174B76]"
      : theme === "dark"
      ? "border-[#1F2937]"
      : "border-[#D0D7E2]";

  const cardBg =
    theme === "midnight"
      ? "bg-[#071A52]/95"
      : theme === "dark"
      ? "bg-[#111827]/95"
      : "bg-[#F0F3FA]";

  const cardBorder =
    theme === "midnight"
      ? "border-[#174B76]"
      : theme === "dark"
      ? "border-[#1F2937]"
      : "border-[#D0D7E2]";

  const avatarBg =
    theme === "light" ? "bg-[#E3E8F3]" : "bg-[#C7F9FF]";

  const titleText =
    theme === "light" ? "text-[#071A52]" : "text-white";

  const accentText =
    theme === "light" ? "text-[#086788]" : "text-[#C7F9FF]";

  const projectTileBg =
    theme === "midnight"
      ? "bg-[#0A245E]/90"
      : theme === "dark"
      ? "bg-[#1A2233]"
      : "bg-[#E3E8F3]";

  const projectTileText =
    theme === "light" ? "text-[#071A52]" : "text-white";

  const techTagBg =
    theme === "midnight"
      ? "bg-[#071A52]"
      : theme === "dark"
      ? "bg-[#111827]"
      : "bg-[#E3E8F3]";

  const techTagBorder =
    theme === "midnight"
      ? "border-[#174B76]"
      : theme === "dark"
      ? "border-[#334155]"
      : "border-[#C9D4E5]";

  const techTagText =
    theme === "light" ? "text-[#071A52]" : "text-[#C7F9FF]";

  // Hover-kanten på kortene følger nå tema: turkis i mørke temaer,
  // mørkeblå i lyst tema for synlig kontrast.
  const cardHoverBorder =
    theme === "light" ? "hover:border-[#086788]" : "hover:border-[#C7F9FF]";

  const themeTransition = "transition-colors duration-300";
  const hoverTransition = "transition-transform duration-300";

  return (
    <MouseParallaxContainer
      className={`relative h-[380px] w-full max-w-md rounded-3xl border ${panelBorder} ${panelBg} ${themeTransition} shadow-2xl shadow-black/40 backdrop-blur-md overflow-hidden px-4 py-4`}
      globalFactorX={0.1}
      globalFactorY={0.1}
      resetOnLeave
    >
      <MouseParallaxChild factorX={0.02} factorY={0.02}>
        <div className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full bg-[#086788]/20 blur-3xl" />
      </MouseParallaxChild>

      <div className="relative flex h-full flex-col gap-3">
        {/* Profilkort */}
        <MouseParallaxChild factorX={0.12} factorY={0.16}>
          <div
            className={`group flex items-center rounded-2xl border ${cardBorder} ${cardBg} ${themeTransition} px-5 py-4 shadow-sm ${cardHoverBorder} hover:shadow-lg hover:shadow-black/40 hover:-translate-y-1 ${hoverTransition}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden ${avatarBg} ${themeTransition}`}
            >
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80"
                alt="Eksempelprofil"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="ml-4">
              <p className={`text-sm font-semibold ${titleText} ${themeTransition}`}>
                Eksempelprofil
              </p>
              <p className={`mt-1 text-xs ${accentText} ${themeTransition}`}>
                @arian
              </p>
              <MutedText className="mt-2 text-xs">
                En vis‑profil med avatar, navn, brukernavn og kort bio.
              </MutedText>
            </div>
          </div>
        </MouseParallaxChild>

        {/* Prosjektkort */}
        <MouseParallaxChild factorX={0.08} factorY={0.1}>
          <div
            className={`group rounded-2xl border ${cardBorder} ${cardBg} ${themeTransition} px-5 py-4 shadow-sm ${cardHoverBorder} hover:shadow-lg hover:shadow-black/40 hover:-translate-y-1 ${hoverTransition}`}
          >
            <p className={`text-xs font-semibold ${accentText} ${themeTransition}`}>
              Prosjekter
            </p>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className={`rounded-lg ${projectTileBg} ${themeTransition} px-3 py-2`}>
                <p className={`font-semibold ${projectTileText} ${themeTransition}`}>
                  Booking App
                </p>
                <MutedText className="mt-1 text-[10px]">Mobil booking.</MutedText>
              </div>

              <div className={`rounded-lg ${projectTileBg} ${themeTransition} px-3 py-2`}>
                <p className={`font-semibold ${projectTileText} ${themeTransition}`}>
                  Weather Map
                </p>
                <MutedText className="mt-1 text-[10px]">Interaktiv kart.</MutedText>
              </div>

              <div className={`rounded-lg ${projectTileBg} ${themeTransition} px-3 py-2`}>
                <p className={`font-semibold ${projectTileText} ${themeTransition}`}>
                  Task App
                </p>
                <MutedText className="mt-1 text-[10px]">Oppgave‑app.</MutedText>
              </div>
            </div>
          </div>
        </MouseParallaxChild>

        {/* Tech-kort */}
        <MouseParallaxChild factorX={0.05} factorY={0.06}>
          <div
            className={`group rounded-2xl border ${cardBorder} ${cardBg} ${themeTransition} px-5 py-4 shadow-sm ${cardHoverBorder} hover:shadow-lg hover:shadow-black/40 hover:-translate-y-1 ${hoverTransition}`}
          >
            <p className={`text-xs font-semibold ${accentText} ${themeTransition}`}>
              Teknologistack
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {["React Native", "Next.js", "TypeScript", "Kotlin"].map((tech) => (
                <span
                  key={tech}
                  className={`rounded-full border ${techTagBorder} ${techTagBg} ${techTagText} ${themeTransition} px-3 py-1 text-[11px]`}
                >
                  {tech}
                </span>
              ))}
            </div>

            <MutedText className="mt-3 text-[11px]">
              Et raskt overblikk over teknologiene bak prosjektene dine.
            </MutedText>
          </div>
        </MouseParallaxChild>
      </div>
    </MouseParallaxContainer>
  );
}