"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, User, Plus, Settings, Moon, Sun, Sparkles } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function Sidebar() {
  const { theme, setTheme } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const pathname = usePathname();

  const sidebarThemeClasses =
    theme === "midnight"
      ? "border-[#174B76]/70 bg-[#0A245E]/85"
      : theme === "dark"
      ? "border-[#1F2937]/70 bg-[#050816]/90"
      : "border-[#D0D7E2] bg-[#FFFFFF]/90";

  const pillBg =
    theme === "midnight"
      ? "bg-[#071A52]/95"
      : theme === "dark"
      ? "bg-[#111827]/95"
      : "bg-[#E3E8F3]";
  const pillText =
    theme === "midnight" || theme === "dark" ? "text-[#C7F9FF]" : "text-[#071A52]";

  const tooltipBg =
    theme === "midnight"
      ? "bg-[#0A245E]/95"
      : theme === "dark"
      ? "bg-[#111827]/95"
      : "bg-white/95";
  const tooltipText =
    theme === "midnight" || theme === "dark" ? "text-[#C7F9FF]" : "text-[#071A52]";

  const themeMenuBg = tooltipBg;

  const activeButtonClasses =
    theme === "light"
      ? "bg-[#071A52] text-white"
      : "bg-[#C7F9FF] text-[#071A52]";

  const homeButtonClasses = activeButtonClasses;

  const themeIconActive =
    theme === "light" ? "bg-[#071A52] text-white" : "bg-[#C7F9FF] text-[#071A52]";
  const themeIconIdle =
    theme === "light" ? "bg-transparent text-[#071A52]" : "bg-transparent text-[#C7F9FF]";
  const themeIconHover =
    theme === "light"
      ? "hover:bg-[#071A52] hover:text-white"
      : "hover:bg-[#C7F9FF] hover:text-[#071A52]";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navItems = [
    { href: "/explore", label: "Utforsk", icon: Search },
    { href: "/login", label: "Profil", icon: User },
    { href: "/register", label: "Registrer", icon: Plus },
  ];

  return (
    <aside className="hidden md:block md:w-24">
      <div
        className={`fixed left-6 top-1/2 flex h-80 w-16 -translate-y-1/2 flex-col items-center justify-between rounded-full border ${sidebarThemeClasses} backdrop-blur-xl shadow-lg shadow-black/40 transition-colors duration-300`}
      >
        {/* Øverst: Hjem */}
        <div className="mt-4">
          <div className="group relative">
            <Link
              href="/"
              className={`flex h-9 w-9 items-center justify-center rounded-2xl text-lg shadow-sm shadow-black/30 transition hover:scale-105 ${
                isActive("/") ? homeButtonClasses : `${pillBg} ${pillText}`
              }`}
              aria-label="Home"
            >
              <Home className="h-5 w-5" />
            </Link>

            <span
              className={`pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full ${tooltipBg} px-3 py-1 text-xs font-medium ${tooltipText} opacity-0 shadow-md shadow-black/30 transition-opacity duration-200 group-hover:opacity-100`}
            >
              Hjem
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <div className="group relative" key={item.href}>
                <Link
                  href={item.href}
                  className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm shadow-black/30 transition-transform duration-200 hover:scale-110 ${
                    active
                      ? activeButtonClasses
                      : `${pillBg} ${pillText} hover:bg-[#086788] hover:text-white`
                  }`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                </Link>

                <span
                  className={`pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full ${tooltipBg} px-3 py-1 text-xs font-medium ${tooltipText} opacity-0 shadow-md shadow-black/30 transition-opacity duration-200 group-hover:opacity-100`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mb-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${pillBg} ${pillText} shadow-sm shadow-black/30 transition-transform duration-200 hover:bg-[#086788] hover:text-[#C7F9FF] hover:scale-110`}
              aria-label="Bytt tema"
            >
              <Settings className="h-4 w-4" />
            </button>

            <span
              className={`pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full ${tooltipBg} px-3 py-1 text-xs font-medium ${tooltipText} opacity-0 shadow-md shadow-black/30 transition-opacity duration-200 group-hover:opacity-100`}
            >
              Tema
            </span>

            <div
              className={`absolute left-14 bottom-0 flex items-center gap-1 rounded-full ${themeMenuBg} p-1 text-xs shadow-md shadow-black/40 transition-opacity duration-200 ${
                isThemeMenuOpen
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Dark */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  theme === "dark" ? themeIconActive : themeIconIdle
                } ${themeIconHover}`}
                aria-label="Mørk tema"
              >
                <Moon className="h-4 w-4" />
              </button>

              {/* Midnight blue */}
              <button
                type="button"
                onClick={() => setTheme("midnight")}
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  theme === "midnight" ? themeIconActive : themeIconIdle
                } ${themeIconHover}`}
                aria-label="Midnight Blue tema"
              >
                <Sparkles className="h-4 w-4" />
              </button>

              {/* Light */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  theme === "light" ? themeIconActive : themeIconIdle
                } ${themeIconHover}`}
                aria-label="Lyst tema"
              >
                <Sun className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}