import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { PersonRow } from "@/components/social/PersonRow";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import type { PersonCard } from "@/lib/social";

// Følgere / følger for en profil.
export default function FollowList({
  name,
  username,
  mode,
  people,
  viewerId,
  counts,
}: {
  name: string;
  username: string;
  mode: "folgere" | "folger";
  people: PersonCard[];
  viewerId?: string | null;
  counts: { followers: number; following: number };
}) {
  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <Link href={`/@${username}`} className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {name}
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{mode === "folgere" ? "Følgere" : "Følger"}</h1>
        <div className="mt-8 border-b border-line">
          <Tabs
            label="Følgere og følger"
            active={mode}
            items={[
              { key: "folgere", label: "Følgere", href: `/@${username}/folgere`, count: counts.followers },
              { key: "folger", label: "Følger", href: `/@${username}/folger`, count: counts.following },
            ]}
          />
        </div>
        {people.length > 0 ? (
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="py-5">
                <PersonRow person={p} viewerId={viewerId} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-10" icon={<Users className="size-5" />} title={mode === "folgere" ? "Ingen følgere ennå" : "Følger ingen ennå"} />
        )}
      </div>
    </main>
  );
}
