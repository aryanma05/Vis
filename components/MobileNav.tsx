"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  User,
  Plus,
  Settings,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

export default function MobileNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const containerClasses =
    theme === "midnight"
      ? "border-[#174B76] bg-[#0A245E]/95"
      : theme === "dark"
      ? "border-[#1F2937] bg-[#050816]/95"
      : "border-[#D0D7E2] bg-white/95";

  const inactiveClasses =
    theme === "light" ? "text-[#071A52]/60" : "text-[#B8D8E3]";

  const activeClasses =
    theme === "light"
      ? "bg-[#071A52] text-white"
      : "bg-[#C7F9FF] text-[#071A52]";

  const themeMenuClasses =
    theme === "midnight"
      ? "border-[#174B76] bg-[#0A245E]"
      : theme === "dark"
      ? "border-[#1F2937] bg-[#0B1220]"
      : "border-[#D0D7E2] bg-white";

  const themeOptionIdle =
    theme === "light" ? "text-[#071A52]" : "text-[#C7F9FF]";

  const items = [
    { href: "/", label: "Hjem", icon: Home },
    { href: "/explore", label: "Utforsk", icon: Search },
    { href: "/login", label: "Profil", icon: User },
    { href: "/register", label: "Registrer", icon: Plus },
  ];

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {isThemeMenuOpen && (
        <button
          type="button"
          aria-label="Lukk temameny"
          onClick={() => setIsThemeMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
        />
      )}

      <nav
        aria-label="Mobilnavigasjon"
        className={`fixed bottom-4 left-4 right-4 z-50 flex items-center justify-around rounded-2xl border p-2 shadow-xl shadow-black/20 backdrop-blur-xl md:hidden ${containerClasses}`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] transition ${
                active
                  ? activeClasses
                  : `${inactiveClasses} hover:bg-[#086788]/20`
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          aria-label="Åpne temameny"
          aria-expanded={isThemeMenuOpen}
          onClick={() => setIsThemeMenuOpen((current) => !current)}
          className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] transition ${
            isThemeMenuOpen
              ? activeClasses
              : `${inactiveClasses} hover:bg-[#086788]/20`
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Tema</span>
        </button>
      </nav>

      {isThemeMenuOpen && (
        <div
          role="dialog"
          aria-label="Velg tema"
          className={`fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border p-2 shadow-xl shadow-black/20 ${themeMenuClasses}`}
        >
          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              setIsThemeMenuOpen(false);
            }}
            aria-label="Velg mørkt tema"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              theme === "dark" ? activeClasses : themeOptionIdle
            } hover:bg-[#C7F9FF] hover:text-[#071A52]`}
          >
            <Moon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("midnight");
              setIsThemeMenuOpen(false);
            }}
            aria-label="Velg midnight blue tema"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              theme === "midnight" ? activeClasses : themeOptionIdle
            } hover:bg-[#C7F9FF] hover:text-[#071A52]`}
          >
            <Sparkles className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("light");
              setIsThemeMenuOpen(false);
            }}
            aria-label="Velg lyst tema"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              theme === "light" ? activeClasses : themeOptionIdle
            } hover:bg-[#071A52] hover:text-white`}
          >
            <Sun className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}