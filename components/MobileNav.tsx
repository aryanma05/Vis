"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, Home, LogIn, Moon, Palette, Plus, Search, Sparkles, Sun, User } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { NavUser } from "@/components/Sidebar";

// Bunnmeny på mobil. Samme valg som sidemenyen på desktop.
export default function MobileNav({ user = null }: { user?: NavUser }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const items = user
    ? [
        { href: "/", label: "Hjem", icon: Home, badge: 0 },
        { href: "/sok", label: "Utforsk", icon: Search, badge: 0 },
        { href: "/ny", label: "Del", icon: Plus, badge: 0 },
        { href: "/varsler", label: "Varsler", icon: Bell, badge: user.unread ?? 0 },
        { href: `/@${user.username}`, label: "Profil", icon: User, badge: 0 },
      ]
    : [
        { href: "/", label: "Hjem", icon: Home, badge: 0 },
        { href: "/sok", label: "Utforsk", icon: Search, badge: 0 },
        { href: "/logg-inn", label: "Logg inn", icon: LogIn, badge: 0 },
        { href: "/register", label: "Registrer", icon: Plus, badge: 0 },
      ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

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
        className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-around rounded-2xl border border-line bg-surface/95 p-2 shadow-xl shadow-black/20 backdrop-blur-xl md:hidden"
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
              className={`relative flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] transition ${
                active ? "bg-primary text-on-primary" : "text-mist hover:bg-sea/20"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-on-primary">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="relative">
          <button
            type="button"
            aria-label="Bytt tema"
            aria-expanded={isThemeMenuOpen}
            onClick={() => setIsThemeMenuOpen((current) => !current)}
            className="flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] text-mist transition hover:bg-sea/20"
          >
            <Palette className="h-4 w-4" />
            <span>Tema</span>
          </button>

          {isThemeMenuOpen && (
            <div className="absolute bottom-16 right-0 z-50 flex items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-xl shadow-black/30">
              {(
                [
                  { name: "dark", label: "Mørkt tema", Icon: Moon },
                  { name: "midnight", label: "Midnattsblått tema", Icon: Sparkles },
                  { name: "light", label: "Lyst tema", Icon: Sun },
                ] as const
              ).map(({ name, label, Icon }) => (
                <button
                  key={name}
                  type="button"
                  aria-label={label}
                  aria-pressed={theme === name}
                  onClick={() => {
                    setTheme(name);
                    setIsThemeMenuOpen(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    theme === name ? "bg-primary text-on-primary" : "text-ice"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
