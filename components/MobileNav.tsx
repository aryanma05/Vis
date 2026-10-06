"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Compass, Home, LogIn, Plus, Search, Settings, UserPlus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { LogoBadge } from "@/components/Logo";
import NavUserMenu, { type NavUser } from "@/components/nav/NavUserMenu";
import { openSearch } from "@/components/nav/search-events";
import { useT } from "@/components/LocaleProvider";
import { openSettings } from "@/components/settings/settings-events";

const tabClass = "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-medium transition-colors";

// Boblen bak valgt fane glir mellom fanene, som i iOS.
function Bubble() {
  return (
    <motion.span
      layoutId="mobilmeny-boble"
      aria-hidden="true"
      className="glass-thumb absolute inset-0 rounded-full"
      transition={{ type: "spring", stiffness: 480, damping: 38 }}
    />
  );
}

// Mobil: en tynn topplinje med logo, innstillinger og søk, og en flytende fanelinje i glass nederst.
export default function MobileNav({ user = null }: { user?: NavUser }) {
  const pathname = usePathname();
  const t = useT();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const tab = (href: string, text: string, Icon: typeof Home, badge = 0) => {
    const active = isActive(href);
    const label = t(text);
    return (
      <Link
        key={href}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`${tabClass} ${active ? "text-fg" : "text-mist"}`}
      >
        {active && <Bubble />}
        <Icon className="relative size-[22px]" strokeWidth={active ? 2.1 : 1.7} />
        <span className="relative">{label}</span>
        {badge > 0 && (
          <span className="absolute right-[calc(50%-20px)] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-semibold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  };

  const profileActive = Boolean(user) && (pathname.startsWith(`/@${user?.username}`) || pathname.startsWith("/profil"));

  return (
    <>
      <header className="sticky top-0 z-40 isolate flex h-16 items-center justify-between px-4 md:hidden print:hidden">
        {/* Uskarphet som tones ut nedover, så innholdet glir inn under i stedet for å kuttes av en kant. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-b from-ink/80 to-transparent backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
        />
        <Link href="/" aria-label={t("Vis – forsiden")} className="rounded-full focus-visible:outline-offset-4">
          <LogoBadge className="size-11 rounded-full shadow-[0_8px_20px_-8px_rgb(0_0_0/0.45)]" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSettings()}
            aria-haspopup="dialog"
            aria-label={t("Innstillinger")}
            className="flex size-9 items-center justify-center rounded-full glass-chip text-fg transition active:scale-90"
          >
            <Settings className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => openSearch()}
            aria-label={t("Søk")}
            className="flex size-9 items-center justify-center rounded-full glass-chip text-fg transition active:scale-90"
          >
            <Search className="size-[18px]" />
          </button>
        </div>
      </header>

      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex items-end gap-2 md:hidden print:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <nav aria-label={t("Mobilmeny")} className="glass pointer-events-auto flex h-[62px] flex-1 items-stretch gap-0.5 rounded-full p-1.5">
          {tab("/", "Hjem", Home)}
          {tab("/sok", "Utforsk", Compass)}
          {user ? (
            <>
              {tab("/varsler", "Varsler", Bell, user.unread ?? 0)}
              <div className="flex flex-1 [&>div]:flex [&>div]:flex-1">
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
                      aria-label={t("Profilmeny")}
                      className={`${tabClass} h-full w-full ${profileActive || open ? "text-fg" : "text-mist"}`}
                    >
                      {profileActive && <Bubble />}
                      <Avatar name={user.name} image={user.image} size={24} className="relative" />
                      <span className="relative">{t("Meg")}</span>
                    </button>
                  )}
                />
              </div>
            </>
          ) : (
            <>
              {tab("/logg-inn", "Logg inn", LogIn)}
              {tab("/register", "Bli med", UserPlus)}
            </>
          )}
        </nav>

        {user && (
          <Link
            href="/ny"
            aria-label={t("Del prosjekt")}
            className="pointer-events-auto flex size-[62px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_12px_30px_-12px_rgb(0_0_0/0.6)] transition active:scale-90"
          >
            <Plus className="size-6" strokeWidth={2.2} />
          </Link>
        )}
      </div>
    </>
  );
}
