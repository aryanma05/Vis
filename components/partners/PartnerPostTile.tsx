import Link from "next/link";
import { ArrowRight, Check, Clock, FolderOpen, Hammer, Lightbulb, MapPin, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import HelpRequestButton from "@/components/partners/HelpRequestButton";
import { ButtonLink } from "@/components/ui/button";
import { COMMITMENT_LABELS, PARTNER_STAGE_LABELS } from "@/lib/constants";
import type { T } from "@/lib/i18n";
import type { PartnerPostCard, RequestStatus } from "@/lib/partner-posts";

// «Idé» eller «Påbegynt prosjekt» som et lite merke.
export function StageBadge({ stage, t }: { stage: PartnerPostCard["stage"]; t: T }) {
  const Icon = stage === "ide" ? Lightbulb : Hammer;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 text-xs font-medium text-fg/85">
      <Icon className={`size-3.5 ${stage === "ide" ? "text-warn" : "text-ice"}`} aria-hidden="true" /> {t(PARTNER_STAGE_LABELS[stage])}
    </span>
  );
}

// Det prosjektet trenger hjelp med, som merker i varm farge så det skiller seg fra teknologiene.
export function NeedChips({ needs, size = "sm" }: { needs: string[]; size?: "xs" | "sm" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {needs.map((need) => (
        <li
          key={need}
          className={`rounded-full bg-warn/15 font-medium text-warn ${size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
        >
          {need}
        </li>
      ))}
    </ul>
  );
}

// Hva innlogget bruker har gjort med utlysningen, i stedet for «Tilby hjelp».
export function RequestState({ status, t }: { status: RequestStatus; t: T }) {
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
        <Check className="size-4" aria-hidden="true" /> {t("Du er med")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-sm font-medium text-mist">
      <Clock className="size-4" aria-hidden="true" /> {status === "pending" ? t("Forespørsel sendt") : t("Ikke denne gangen")}
    </span>
  );
}

export default function PartnerPostTile({ post, t, viewerId }: { post: PartnerPostCard; t: T; viewerId?: string | null }) {
  const isOwner = viewerId === post.owner.id;
  const href = `/partnere/${post.id}`;

  return (
    <li className="flex flex-col rounded-[22px] glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StageBadge stage={post.stage} t={t} />
        {post.interest > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-mist">
            <Users className="size-3.5" aria-hidden="true" />
            {post.interest === 1 ? t("1 vil hjelpe") : t("{n} vil hjelpe", { n: post.interest })}
          </span>
        )}
      </div>

      <Link href={href} className="mt-3 block text-lg font-semibold leading-snug tracking-[-0.015em] hover:text-ice">
        {post.title}
      </Link>
      <p className="mt-1.5 line-clamp-3 text-[15px] leading-6 text-fg/80">{post.description}</p>

      {post.needs.length > 0 && (
        <div className="mt-4">
          <p className="sr-only">{t("Trenger hjelp med")}</p>
          <NeedChips needs={post.needs} />
        </div>
      )}

      <ul className="mt-4 space-y-1.5 text-[13px] text-mist">
        <li>{post.commitments.map((c) => t(COMMITMENT_LABELS[c].label)).join(" · ")}</li>
        {post.project && (
          <li className="flex items-center gap-2">
            <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
            <Link href={`/prosjekt/${post.project.id}`} className="truncate hover:text-fg">
              {post.project.title}
            </Link>
          </li>
        )}
      </ul>

      <div className="mt-auto pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <Link href={`/@${post.owner.username}`} className="group flex min-w-0 items-center gap-2.5">
          <Avatar name={post.owner.name} image={post.owner.image} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold group-hover:text-ice">{post.owner.name}</span>
            {post.owner.location && (
              <span className="flex items-center gap-1 truncate text-xs text-mist">
                <MapPin className="size-3 shrink-0" aria-hidden="true" /> {post.owner.location}
              </span>
            )}
          </span>
        </Link>
        {isOwner ? (
          <ButtonLink href={href} size="sm" variant="secondary">
            {t("Ditt prosjekt")} <ArrowRight className="size-4" />
          </ButtonLink>
        ) : post.myRequest ? (
          <Link href={href}>
            <RequestState status={post.myRequest} t={t} />
          </Link>
        ) : (
          <HelpRequestButton
            postId={post.id}
            title={post.title}
            ownerName={post.owner.name}
            commitments={post.commitments}
            loggedIn={Boolean(viewerId)}
            size="sm"
          />
        )}
      </div>
      </div>
    </li>
  );
}
