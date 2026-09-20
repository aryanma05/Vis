"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Home, LogIn, LogOut, Moon, Plus, Search, Settings, Sparkles, Sun, UserPlus } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { authClient } from "@/lib/auth-client";

export type NavUser = { username: string; name: string; image: string | null; unread?: number } | null;

// Flytende sidemeny på desktop. Menyvalgene endrer seg etter om du er logget inn.
export default function Sidebar({ user = null }: { user?: NavUser }) {
  const { theme, setTheme } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navItems = user
    ? [
        { href: "/sok", label: "Utforsk", icon: Search },
        { href: "/ny", label: "Del prosjekt", icon: Plus },
        { href: "/varsler", label: "Varsler", icon: Bell, badge: user.unread ?? 0 },
        { href: `/@${user.username}`, label: "Profilen din", icon: UserAvatar(user) },
      ]
    : [
        { href: "/sok", label: "Utforsk", icon: Search },
        { href: "/logg-inn", label: "Logg inn", icon: LogIn },
        { href: "/register", label: "Lag profil", icon: UserPlus },
      ];

  const pill = "bg-ink/95 text-ice";
  const active = "bg-primary text-on-primary";
  const tooltip =
    "pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-surface/95 px-3 py-1 text-xs font-medium text-ice opacity-0 shadow-md shadow-black/30 transition-opacity duration-200 group-hover:opacity-100";

  return (
    <aside className="pointer-events-none fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 md:block">
      <div className="pointer-events-auto flex w-16 flex-col items-center gap-4 rounded-full border border-line/70 bg-surface/85 py-4 shadow-lg shadow-black/40 backdrop-blur-xl transition-colors duration-300">
        <div className="group relative">
          <Link
            href="/"
            aria-label="Hjem"
            aria-current={isActive("/") ? "page" : undefined}
            className={`flex h-9 w-9 items-center justify-center rounded-2xl shadow-sm shadow-black/30 transition hover:scale-105 ${
              isActive("/") ? active : pill
            }`}
          >
            <Home className="h-5 w-5" />
          </Link>
          <span className={tooltip}>Hjem</span>
        </div>

        <div className="my-1 h-px w-6 bg-line" />

        {navItems.map((item) => {
          const Icon = item.icon;
          const current = isActive(item.href);
          const badge = "badge" in item ? (item.badge ?? 0) : 0;

          return (
            <div className="group relative" key={item.href}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={current ? "page" : undefined}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full shadow-sm shadow-black/30 transition-transform duration-200 hover:scale-110 ${
                  current ? active : `${pill} hover:bg-sea hover:text-white`
                }`}
              >
                <Icon className="h-4 w-4" />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-primary">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
              <span className={tooltip}>{item.label}</span>
            </div>
          );
        })}

        <div className="my-1 h-px w-6 bg-line" />

        {user && (
          <div className="group relative">
            <button
              type="button"
              aria-label="Logg ut"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${pill} shadow-sm shadow-black/30 transition-transform duration-200 hover:scale-110 hover:bg-sea hover:text-white`}
            >
              <LogOut className="h-4 w-4" />
            </button>
            <span className={tooltip}>Logg ut</span>
          </div>
        )}

        <div className="group relative">
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen((prev) => !prev)}
            aria-label="Bytt tema"
            aria-expanded={isThemeMenuOpen}
            className={`flex h-8 w-8 items-center justify-center rounded-full ${pill} shadow-sm shadow-black/30 transition-transform duration-200 hover:scale-110 hover:bg-sea hover:text-white`}
          >
            <Settings className="h-4 w-4" />
          </button>

          {!isThemeMenuOpen && <span className={tooltip}>Tema</span>}

          <div
            className={`absolute bottom-0 left-12 flex items-center gap-1 rounded-full bg-surface/95 p-1 text-xs shadow-md shadow-black/40 transition-opacity duration-200 ${
              isThemeMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
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
                onClick={() => setTheme(name)}
                aria-label={label}
                aria-pressed={theme === name}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                  theme === name ? active : "text-ice hover:bg-primary hover:text-on-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

// Profilbildet brukes som ikon for profil-lenken.
function UserAvatar(user: NonNullable<NavUser>) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  function Avatar({ className = "" }: { className?: string }) {
    if (user.image) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={user.image} alt="" className={`${className} h-5 w-5 rounded-full object-cover`} />;
    }
    return <span className={`${className} text-[10px] font-semibold`}>{initials}</span>;
  }

  return Avatar;
}
