import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-[#174B76] bg-[#071A52]/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          vis
        </Link>

        {user ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/importer" className="text-[#B8D8E3] transition hover:text-white">
              Importer
            </Link>
            <Link
              href="/ny"
              className="rounded-lg border border-[#174B76] px-4 py-2 font-medium text-[#C7F9FF] transition hover:border-[#C7F9FF] hover:bg-[#0A245E]"
            >
              Nytt prosjekt
            </Link>
            <Link href={`/@${user.username}`} className="font-medium text-white transition hover:text-[#C7F9FF]">
              @{user.username}
            </Link>
            <SignOutButton />
          </nav>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/logg-inn" className="text-[#B8D8E3] transition hover:text-white">
              Logg inn
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-[#174B76] px-4 py-2 font-medium text-[#C7F9FF] transition hover:border-[#C7F9FF] hover:bg-[#0A245E]"
            >
              Lag profil
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
