import Link from "next/link";
import { MapPin } from "lucide-react";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/social/FollowButton";
import { compactNumber } from "@/components/ui/misc";
import type { PersonCard } from "@/lib/social";

// En person i en liste (forslag, følgere, søketreff).
export function PersonRow({ person, viewerId, compact = false }: { person: PersonCard; viewerId?: string | null; compact?: boolean }) {
  const isSelf = viewerId === person.id;
  return (
    <div className="group flex items-center gap-3.5">
      <Link href={`/@${person.username}`} className="shrink-0">
        <Avatar name={person.name} image={person.image} size={compact ? 40 : 48} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/@${person.username}`} className="block truncate font-semibold text-fg transition group-hover:text-ice">
          {person.name}
        </Link>
        <p className="truncate text-[13px] text-mist">{person.headline ?? `@${person.username}`}</p>
        {!compact && (
          <p className="mt-0.5 flex items-center gap-3 text-xs text-mist/75">
            {person.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden="true" />
                {person.location}
              </span>
            )}
            <span>{compactNumber(person.projectCount)} prosjekter</span>
            <span>{compactNumber(person.followerCount)} følgere</span>
          </p>
        )}
      </div>
      {!isSelf && (
        <FollowButton userId={person.id} initialFollowing={person.isFollowing} loggedIn={Boolean(viewerId)} size="xs" name={person.name} />
      )}
    </div>
  );
}

// Personkort i rutenett (søk etter folk, teknologisider).
export function PersonTile({ person, viewerId }: { person: PersonCard; viewerId?: string | null }) {
  const isSelf = viewerId === person.id;
  return (
    <article className="group relative flex flex-col rounded-3xl border border-line bg-surface/50 p-5 transition hover:-translate-y-0.5 hover:border-ice/40 hover:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <Avatar name={person.name} image={person.image} size={56} />
        {!isSelf && (
          <div className="relative z-10">
            <FollowButton userId={person.id} initialFollowing={person.isFollowing} loggedIn={Boolean(viewerId)} size="xs" name={person.name} />
          </div>
        )}
      </div>
      <Link href={`/@${person.username}`} className="mt-4 block font-semibold tracking-tight text-fg after:absolute after:inset-0 after:rounded-3xl">
        {person.name}
      </Link>
      <p className="text-[13px] text-mist">@{person.username}</p>
      {person.headline && <p className="mt-3 line-clamp-2 text-sm leading-6 text-fg/85">{person.headline}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-mist">
        {person.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden="true" />
            {person.location}
          </span>
        )}
        <span>
          <span className="font-semibold text-fg">{compactNumber(person.projectCount)}</span> prosjekter
        </span>
        <span>
          <span className="font-semibold text-fg">{compactNumber(person.followerCount)}</span> følgere
        </span>
      </div>
    </article>
  );
}
