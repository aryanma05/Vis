import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import FollowTabs from "@/components/profile/FollowTabs";
import { PersonRow } from "@/components/social/PersonRow";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { getT } from "@/lib/i18n/server";
import type { PersonCard } from "@/lib/social";

// Følgere / følger for en profil. Begge listene lastes med en gang, så fanene kan
// byttes uten å laste en ny side (se FollowTabs).
export default async function FollowList({
  name,
  username,
  mode,
  followers,
  following,
  viewerId,
  counts,
}: {
  name: string;
  username: string;
  mode: "folgere" | "folger";
  followers: PersonCard[];
  following: PersonCard[];
  viewerId?: string | null;
  counts: { followers: number; following: number };
}) {
  const t = await getT();
  const list = (people: PersonCard[], empty: string) =>
    people.length > 0 ? (
      <ul className="divide-y divide-line">
        {people.map((p) => (
          <li key={p.id} className="py-5">
            <PersonRow person={p} viewerId={viewerId} />
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState className="mt-10" icon={<Users className="size-5" />} title={empty} />
    );

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <Link href={`/@${username}`} className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {name}
        </Link>
        <FollowTabs
          username={username}
          initial={mode}
          counts={counts}
          titles={{ folgere: t("Følgere til {name}", { name }), folger: t("{name} følger", { name }) }}
          followers={list(followers, t("Ingen følgere ennå"))}
          following={list(following, t("Følger ingen ennå"))}
        />
      </div>
    </main>
  );
}

// Vises mens siden lastes, så overgangen fra profilen ikke blinker innom profilskjelettet.
export function FollowListSkeleton() {
  return (
    <main aria-busy="true" className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-5 h-10 w-48 md:h-12" />
        <Skeleton className="mt-8 h-11 w-64 rounded-full" />
        <ul className="divide-y divide-line">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3.5 py-5">
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-56" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
