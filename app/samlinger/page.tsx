import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Globe2, Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { listOwnCollections } from "@/lib/collections";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Samlinger", robots: { index: false } };

export default async function MyCollectionsPage() {
  const user = await requireUser();
  const collections = await listOwnCollections(user.id);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <p className="caption">Lagret</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Samlinger</h1>
        <p className="mt-3 text-mist">Trykk på bokmerket på et prosjekt for å lagre det. Offentlige samlinger vises på profilen din.</p>
        {collections.length === 0 ? (
          <EmptyState className="mt-10" icon={<Bookmark className="size-5" />} title="Ingen samlinger ennå">
            Finn noe du liker under Utforsk, og lagre det.
          </EmptyState>
        ) : (
          <ul className="mt-8 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {collections.map((c) => (
              <li key={c.id}>
                <Link href={`/samling/${c.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-fill">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-fill text-mist">
                    {c.isPublic ? <Globe2 className="size-4" /> : <Lock className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.title}</span>
                    <span className="text-sm text-mist">
                      {c.items} {c.items === 1 ? "prosjekt" : "prosjekter"} · {c.isPublic ? "offentlig" : "privat"} · endret{" "}
                      <span suppressHydrationWarning>{timeAgo(c.updatedAt)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
