"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Compass, Handshake, LogIn, Plus, Settings } from "lucide-react";
import Avatar from "@/components/Avatar";
import NavUserMenu, { UnreadBadge, type NavUser } from "@/components/nav/NavUserMenu";
import { useT } from "@/components/LocaleProvider";
import { openSettings } from "@/components/settings/settings-events";

export type { NavUser };

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="glass-strong pointer-events-none absolute left-full top-1/2 ml-4 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-fg opacity-0 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
      {children}
    </span>
  );
}

const itemBase =
  "relative flex size-11 items-center justify-center rounded-full transition duration-200 active:scale-90 focus-visible:outline-offset-2";

// Flytende sidemeny i glass på desktop. Menyvalgene endrer seg etter om du er logget inn.
// Logoen øverst til venstre (components/nav/HomeLogo.tsx) er veien til forsiden/strømmen.
// Varslene ligger i profilmenyen, med antallet på profilbildet. Innstillingene (tannhjulet)
// ligger alltid nederst. Søket ligger i Utforsk (og bak ⌘K).
export default function Sidebar({ user = null }: { user?: NavUser }) {
  const pathname = usePathname();
  const t = useT();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const items = [
    { href: "/sok", label: t("Utforsk"), Icon: Compass },
    { href: "/partnere", label: t("Finn partnere"), Icon: Handshake },
    { href: "/stillinger", label: t("Stillinger"), Icon: Briefcase },
  ];

  return (
    <aside className="pointer-events-none fixed inset-y-0 left-5 z-40 hidden items-center md:flex print:!hidden">
      <nav
        aria-label={t("Hovedmeny")}
        className="glass pointer-events-auto flex w-[60px] flex-col items-center gap-1 rounded-full py-2"
      >
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <div key={href} className="group relative">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`${itemBase} ${active ? "glass-thumb text-fg" : "text-mist hover:bg-fill hover:text-fg"}`}
              >
                <Icon className="size-[19px]" strokeWidth={active ? 2.2 : 1.8} />
              </Link>
              <Tip>{label}</Tip>
            </div>
          );
        })}

        <div className="my-1.5 h-px w-7 bg-line" />

        {user ? (
          <>
            <div className="group relative">
              <Link
                href="/ny"
                aria-label={t("Del prosjekt")}
                className={`${itemBase} bg-primary text-on-primary hover:opacity-90`}
              >
                <Plus className="size-5" strokeWidth={2.2} />
              </Link>
              <Tip>{t("Del prosjekt")}</Tip>
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
                    aria-label={user.unread ? t("Profilmeny, {n} uleste varsler", { n: user.unread }) : t("Profilmeny")}
                    className={`relative rounded-full p-0.5 ring-2 transition active:scale-90 ${
                      open || pathname.startsWith(`/@${user.username}`) || pathname.startsWith("/profil") || pathname.startsWith("/varsler") ? "ring-fg/30" : "ring-transparent hover:ring-fill-2"
                    }`}
                  >
                    <Avatar name={user.name} image={user.image} size={36} />
                    <UnreadBadge count={user.unread ?? 0} className="absolute -right-1 -top-1" />
                  </button>
                  {!open && <Tip>{user.name}</Tip>}
                </div>
              )}
            />
          </>
        ) : (
          <>
            <div className="group relative">
              <Link href="/logg-inn" aria-label={t("Logg inn")} className={`${itemBase} text-mist hover:bg-fill hover:text-fg`}>
                <LogIn className="size-[19px]" />
              </Link>
              <Tip>{t("Logg inn")}</Tip>
            </div>
            <div className="group relative">
              <Link
                href="/register"
                aria-label={t("Lag profil")}
                className={`${itemBase} bg-primary text-on-primary hover:opacity-90`}
              >
                <Plus className="size-5" strokeWidth={2.2} />
              </Link>
              <Tip>{t("Lag profil")}</Tip>
            </div>
          </>
        )}

        <div className="group relative">
          <button
            type="button"
            onClick={() => openSettings()}
            aria-haspopup="dialog"
            aria-label={t("Innstillinger")}
            className={`${itemBase} text-mist hover:bg-fill hover:text-fg [&>svg]:transition-transform [&>svg]:duration-500 hover:[&>svg]:rotate-90`}
          >
            <Settings className="size-[19px]" />
          </button>
          <Tip>{t("Innstillinger")}</Tip>
        </div>
      </nav>
    </aside>
  );
}
