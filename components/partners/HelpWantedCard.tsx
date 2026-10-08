import Link from "next/link";
import { ArrowRight, HandHeart, Plus } from "lucide-react";
import HelpRequestButton from "@/components/partners/HelpRequestButton";
import { NeedChips, RequestState } from "@/components/partners/PartnerPostTile";
import type { T } from "@/lib/i18n";
import type { PartnerPostCard } from "@/lib/partner-posts";

// «Trenger hjelp med» i visittkortet på profilen: de åpne prosjektene personen har lagt
// ut under Samarbeid, så man ser det med en gang man kommer inn på profilen.
export default function HelpWantedCard({
  posts,
  isOwner,
  loggedIn,
  t,
}: {
  posts: PartnerPostCard[];
  isOwner: boolean;
  loggedIn: boolean;
  t: T;
}) {
  if (posts.length === 0) return null;
  const only = posts.length === 1 ? posts[0] : null;

  return (
    <section className="mt-4 rounded-[18px] bg-warn/10 p-3.5" aria-labelledby="trenger-hjelp">
      <h2 id="trenger-hjelp" className="flex items-center gap-2 text-[13px] font-semibold text-warn">
        <HandHeart className="size-4" aria-hidden="true" />
        {t("Trenger hjelp med")}
      </h2>
      <ul className="mt-2.5 space-y-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/partnere/${post.id}`} className="group flex items-start justify-between gap-2">
              <span className="text-[15px] font-semibold leading-snug text-fg group-hover:underline">{post.title}</span>
              <ArrowRight className="mt-1 size-3.5 shrink-0 text-mist transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            {post.needs.length > 0 && (
              <div className="mt-1.5">
                <NeedChips needs={post.needs} size="xs" />
              </div>
            )}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <Link href="/partnere/ny" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-mist hover:text-fg">
          <Plus className="size-3.5" /> {t("Legg ut et prosjekt")}
        </Link>
      ) : only?.myRequest ? (
        <Link href={`/partnere/${only.id}`} className="mt-3 inline-flex">
          <RequestState status={only.myRequest} t={t} />
        </Link>
      ) : only ? (
        <HelpRequestButton
          postId={only.id}
          title={only.title}
          ownerName={only.owner.name}
          commitments={only.commitments}
          loggedIn={loggedIn}
          size="sm"
          className="mt-3 w-full"
        />
      ) : null}
    </section>
  );
}
