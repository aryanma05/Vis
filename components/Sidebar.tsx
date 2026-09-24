"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, LogIn, Plus, Search } from "lucide-react";
import Avatar from "@/components/Avatar";
import { LogoMark } from "@/components/Logo";
import NavUserMenu, { ThemeButtons, type NavUser } from "@/components/nav/NavUserMenu";
import { openSearch } from "@/components/nav/search-events";
import { Menu } from "@/components/ui/menu";
import { Palette } from "lucide-react";

export type { NavUser };

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 ml-4 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg opacity-0 shadow-lg shadow-black/20 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
      {children}
    </span>
  );
}

const itemBase =
  "relative flex size-10 items-center justify-center rounded-xl transition duration-200 focus-visible:outline-offset-4";

// Flytende sidemeny på desktop. Menyvalgene endrer seg etter om du er logget inn.
export default function Sidebar({ user = null }: { user?: NavUser }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const items = [
    { href: "/", label: user ? "Strømmen" : "Hjem", Icon: Home },
    { href: "/sok", label: "Utforsk", Icon: Compass },
    ...(user ? [{ href: "/varsler", label: "Varsler", Icon: Bell, badge: user.unread ?? 0 }] : []),
  ];

  return (
    <aside className="pointer-events-none fixed inset-y-0 left-5 z-40 hidden items-center md:flex print:!hidden">
      <nav
        aria-label="Hovedmeny"
        className="pointer-events-auto flex w-14 flex-col items-center gap-2 rounded-[22px] border border-line bg-surface/80 py-3 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.65)] backdrop-blur-xl"
      >
        <Link href="/" aria-label="Vis – forsiden" className="group relative mb-1">
          <LogoMark className="size-10 transition group-hover:scale-105" />
        </Link>

        <div className="group relative">
          <button
            type="button"
            onClick={() => openSearch()}
            aria-label="Søk (⌘K)"
            className={`${itemBase} text-mist hover:bg-surface-2 hover:text-fg`}
          >
            <Search className="size-[18px]" />
          </button>
          <Tip>
            Søk <span className="ml-1 font-mono text-[10px] text-mist">⌘K</span>
          </Tip>
        </div>

        {items.map(({ href, label, Icon, ...rest }) => {
          const active = isActive(href);
          const badge = "badge" in rest ? (rest.badge as number) : 0;
          return (
            <div key={href} className="group relative">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`${itemBase} ${active ? "bg-fg/10 text-fg" : "text-mist hover:bg-surface-2 hover:text-fg"}`}
              >
                <Icon className="size-[18px]" />
                {active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-ice" aria-hidden="true" />}
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ice px-1 text-[10px] font-bold text-on-primary ring-2 ring-surface">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
              <Tip>{label}</Tip>
            </div>
          );
        })}

        <div className="my-1 h-px w-6 bg-line" />

        {user ? (
          <>
            <div className="group relative">
              <Link
                href="/ny"
                aria-label="Del prosjekt"
                className={`${itemBase} bg-primary text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] hover:scale-105`}
              >
                <Plus className="size-5" strokeWidth={2.4} />
              </Link>
              <Tip>Del prosjekt</Tip>
            </div>
            <NavUserMenu
              user={user}
              side="right"
              align="end"
              trigger={({ open, toggle, id }) => (
                <div className="group relative mt-1">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-controls={open ? id : undefined}
                    aria-label="Profilmeny"
                    className={`rounded-full p-0.5 ring-2 transition ${
                      open || pathname.startsWith(`/@${user.username}`) || pathname.startsWith("/profil") ? "ring-ice" : "ring-transparent hover:ring-line"
                    }`}
                  >
                    <Avatar name={user.name} image={user.image} size={36} />
                  </button>
                  {!open && <Tip>{user.name}</Tip>}
                </div>
              )}
            />
          </>
        ) : (
          <>
            <div className="group relative">
              <Link href="/logg-inn" aria-label="Logg inn" className={`${itemBase} text-mist hover:bg-surface-2 hover:text-fg`}>
                <LogIn className="size-[18px]" />
              </Link>
              <Tip>Logg inn</Tip>
            </div>
            <div className="group relative">
              <Link
                href="/register"
                aria-label="Lag profil"
                className={`${itemBase} bg-primary text-on-primary hover:scale-105`}
              >
                <Plus className="size-5" strokeWidth={2.4} />
              </Link>
              <Tip>Lag profil</Tip>
            </div>
            <Menu
              label="Tema"
              side="right"
              align="end"
              className="w-56 p-2"
              trigger={({ open, toggle }) => (
                <div className="group relative">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label="Fargetema"
                    className={`${itemBase} text-mist hover:bg-surface-2 hover:text-fg`}
                  >
                    <Palette className="size-[18px]" />
                  </button>
                  {!open && <Tip>Tema</Tip>}
                </div>
              )}
            >
              <p className="px-1 pb-2 pt-1 label-mono">Tema</p>
              <ThemeButtons />
            </Menu>
          </>
        )}
      </nav>
    </aside>
  );
}
