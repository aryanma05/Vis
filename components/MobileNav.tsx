"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, LogIn, Palette, Plus, Search } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Wordmark } from "@/components/Logo";
import NavUserMenu, { ThemeButtons, type NavUser } from "@/components/nav/NavUserMenu";
import { openSearch } from "@/components/nav/search-events";
import { Menu } from "@/components/ui/menu";

// Mobil: en tynn topplinje med logo og søk, og en meny nederst med hovedvalgene.
export default function MobileNav({ user = null }: { user?: NavUser }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const tab = (href: string, label: string, Icon: typeof Home, badge = 0) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium transition ${
          active ? "text-fg" : "text-mist"
        }`}
      >
        <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
        <span>{label}</span>
        {badge > 0 && (
          <span className="absolute right-[calc(50%-18px)] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ice px-1 text-[9.5px] font-bold text-on-primary">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line/60 bg-ink/85 px-4 backdrop-blur-xl md:hidden print:hidden">
        <Link href="/" aria-label="Vis – forsiden">
          <Wordmark className="text-[22px]" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openSearch()}
            aria-label="Søk"
            className="flex size-10 items-center justify-center rounded-xl text-mist transition hover:bg-surface hover:text-fg"
          >
            <Search className="size-5" />
          </button>
          {!user && (
            <>
              <Menu
                label="Tema"
                side="bottom"
                align="end"
                className="w-56 p-2"
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label="Fargetema"
                    className="flex size-10 items-center justify-center rounded-xl text-mist transition hover:bg-surface hover:text-fg"
                  >
                    <Palette className="size-5" />
                  </button>
                )}
              >
                <ThemeButtons />
              </Menu>
              <Link href="/logg-inn" className="ml-1 rounded-lg px-3 py-2 text-sm font-semibold text-fg">
                Logg inn
              </Link>
            </>
          )}
        </div>
      </header>

      <nav
        aria-label="Mobilmeny"
        className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-1 rounded-2xl border border-line bg-surface/90 px-2 py-1.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.7)] backdrop-blur-xl md:hidden print:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {tab("/", "Hjem", Home)}
        {tab("/sok", "Utforsk", Compass)}
        {user ? (
          <>
            <Link
              href="/ny"
              aria-label="Del prosjekt"
              className="mx-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
            >
              <Plus className="size-6" strokeWidth={2.4} />
            </Link>
            {tab("/varsler", "Varsler", Bell, user.unread ?? 0)}
            <div className="flex flex-1 justify-center">
              <NavUserMenu
                user={user}
                side="top"
                align="end"
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label="Profilmeny"
                    className="flex flex-col items-center gap-1 py-1.5 text-[10.5px] font-medium text-mist"
                  >
                    <Avatar name={user.name} image={user.image} size={22} className={open ? "ring-2 ring-ice" : ""} />
                    <span>Meg</span>
                  </button>
                )}
              />
            </div>
          </>
        ) : (
          <>
            <Link
              href="/register"
              aria-label="Lag profil"
              className="mx-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary"
            >
              <Plus className="size-6" strokeWidth={2.4} />
            </Link>
            {tab("/logg-inn", "Logg inn", LogIn)}
            <button
              type="button"
              onClick={() => openSearch()}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium text-mist"
            >
              <Search className="size-5" strokeWidth={1.8} />
              <span>Søk</span>
            </button>
          </>
        )}
      </nav>
    </>
  );
}
