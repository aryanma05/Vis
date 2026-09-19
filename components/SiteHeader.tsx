import Link from "next/link";
import Avatar from "@/components/Avatar";
import { BellIcon, SearchIcon } from "@/components/icons";
import SignOutButton from "@/components/SignOutButton";
import { getUnreadCount } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

// variant "overlay" ligger oppå bølgene på forsiden, "solid" brukes ellers.
export default async function SiteHeader({ variant = "solid" }: { variant?: "solid" | "overlay" }) {
  const user = await getCurrentUser();
  const unread = user ? await getUnreadCount(user.id) : 0;

  const shell =
    variant === "overlay"
      ? "absolute inset-x-0 top-0 z-20"
      : "sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-md";

  return (
    <header className={shell}>
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          vis
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-mist sm:flex">
          <Link href="/sok" className="transition hover:text-white">
            Utforsk
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            href="/sok"
            aria-label="Søk"
            className="flex h-9 items-center gap-2 rounded-lg border border-line/80 px-3 text-sm text-mist transition hover:border-mist/60 hover:text-white"
          >
            <SearchIcon />
            <span className="hidden md:inline">Søk i prosjekter</span>
          </Link>

          {user ? (
            <>
              <Link
                href="/varsler"
                aria-label={unread > 0 ? `${unread} uleste varsler` : "Varsler"}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-mist transition hover:bg-white/5 hover:text-white"
              >
                <BellIcon />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ice px-1 text-[10px] font-semibold text-ink">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link
                href="/ny"
                className="hidden h-9 items-center rounded-lg bg-ice px-4 text-sm font-semibold text-ink transition hover:bg-white sm:flex"
              >
                Del prosjekt
              </Link>
              <Link href={`/@${user.username}`} aria-label="Min profil" className="ml-1">
                <Avatar name={user.name} image={user.image ?? null} size={34} />
              </Link>
              <span className="hidden lg:block">
                <SignOutButton />
              </span>
            </>
          ) : (
            <>
              <Link href="/logg-inn" className="px-2 text-sm text-mist transition hover:text-white">
                Logg inn
              </Link>
              <Link
                href="/register"
                className="flex h-9 items-center rounded-lg bg-ice px-4 text-sm font-semibold text-ink transition hover:bg-white"
              >
                Lag profil
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
