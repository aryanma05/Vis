import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Clock, FolderOpen, Inbox, Lock, Mail, MapPin, UserRound, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import HelpRequestButton from "@/components/partners/HelpRequestButton";
import { NeedChips, StageBadge } from "@/components/partners/PartnerPostTile";
import PostOwnerActions from "@/components/partners/PostOwnerActions";
import { AnswerRequest, WithdrawRequest } from "@/components/partners/RequestActions";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { COMMITMENT_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { makeT, type Locale, type T } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { getPartnerPost, type PartnerPostDetail, type PartnerRequestItem } from "@/lib/partner-posts";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [post, t] = await Promise.all([getPartnerPost(id), getT()]);
  if (!post) return { title: t("Fant ikke prosjektet"), robots: { index: false } };
  const description = post.description.slice(0, 160);
  return {
    title: t("{title} – trenger hjelp", { title: post.title }),
    description,
    alternates: { canonical: `/partnere/${post.id}` },
    openGraph: { title: post.title, description, url: `/partnere/${post.id}` },
    robots: post.closed ? { index: false } : undefined,
  };
}

const STATUS_CHIP = {
  pending: { label: "Ny", className: "bg-primary text-on-primary" },
  accepted: { label: "Med på laget", className: "bg-success/10 text-success" },
  declined: { label: "Takket nei", className: "bg-fill text-mist" },
} as const;

// En forespørsel slik eieren ser den: hvem, hvor mye de vil bidra, meldingen og svaret.
function RequestRow({ request, post, t, locale }: { request: PartnerRequestItem; post: PartnerPostDetail; t: T; locale: Locale }) {
  const { sender } = request;
  const first = sender.name.split(" ")[0] || sender.name;
  const chip = STATUS_CHIP[request.status];
  const subject = encodeURIComponent(t("Om «{title}» på Vis", { title: post.title }));
  return (
    <li className={`p-5 ${request.status === "declined" ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <Link href={`/@${sender.username}`} className="shrink-0">
          <Avatar name={sender.name} image={sender.image} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/@${sender.username}`} className="font-semibold hover:text-ice">
              {sender.name}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.className}`}>{t(chip.label)}</span>
          </div>
          <p className="truncate text-sm text-mist">{sender.headline ?? `@${sender.username}`}</p>
          <p className="mt-1 text-xs text-mist">
            {t(COMMITMENT_LABELS[request.commitment].label)} · <span suppressHydrationWarning>{timeAgo(request.createdAt, locale)}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-fg/90">{request.message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {request.status === "accepted" ? (
          <>
            <ButtonLink href={`mailto:${sender.email}?subject=${subject}`} size="sm">
              <Mail className="size-4" /> {t("Skriv til {name}", { name: first })}
            </ButtonLink>
            {post.project && (
              <ButtonLink href={`/prosjekt/${post.project.id}/rediger`} size="sm" variant="secondary">
                <Users className="size-4" /> {t("Legg til i teamet")}
              </ButtonLink>
            )}
          </>
        ) : (
          <>
            <AnswerRequest requestId={request.id} name={sender.name} status={request.status} />
            {request.status === "pending" && (
              <ButtonLink href={`mailto:${sender.email}?subject=${subject}`} size="sm" variant="ghost">
                <Mail className="size-4" /> {t("Spør først")}
              </ButtonLink>
            )}
          </>
        )}
        <ButtonLink href={`/@${sender.username}`} size="sm" variant="ghost">
          <UserRound className="size-4" /> {t("Profil")}
        </ButtonLink>
      </div>
    </li>
  );
}

// Det den innloggede (ikke eieren) ser i sidekolonnen: knappen, eller svaret på forespørselen.
function ViewerPanel({ post, loggedIn, t, locale }: { post: PartnerPostDetail; loggedIn: boolean; t: T; locale: Locale }) {
  const first = post.owner.name.split(" ")[0] || post.owner.name;
  const mine = post.mine;

  if (mine?.status === "accepted") {
    const subject = encodeURIComponent(t("Om «{title}» på Vis", { title: post.title }));
    return (
      <section className="rounded-[22px] bg-success/10 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-success">
          <Check className="size-4" aria-hidden="true" /> {t("{name} sa ja!", { name: first })}
        </h2>
        <p className="mt-2 text-sm leading-6 text-fg/85">{t("Ta kontakt for å avtale hvordan dere kommer i gang.")}</p>
        {post.ownerEmail && (
          <ButtonLink href={`mailto:${post.ownerEmail}?subject=${subject}`} size="sm" className="mt-4 w-full">
            <Mail className="size-4" /> {t("Skriv til {name}", { name: first })}
          </ButtonLink>
        )}
        <div className="mt-2 text-center">
          <WithdrawRequest requestId={mine.id} accepted />
        </div>
      </section>
    );
  }

  if (mine) {
    return (
      <section className="rounded-[22px] glass-card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Clock className="size-4 text-mist" aria-hidden="true" />
          {mine.status === "pending" ? t("Forespørselen er sendt") : t("Ikke denne gangen")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-mist">
          {mine.status === "pending"
            ? t("Du får et varsel når {name} svarer.", { name: first })
            : t("{name} har takket nei denne gangen. Kanskje et annet prosjekt passer?", { name: first })}
        </p>
        <blockquote className="mt-4 rounded-[14px] bg-fill px-4 py-3 text-sm leading-6 text-fg/85">
          <p className="text-xs text-mist">
            {t(COMMITMENT_LABELS[mine.commitment].label)} · <span suppressHydrationWarning>{timeAgo(mine.createdAt, locale)}</span>
          </p>
          <p className="mt-1 line-clamp-6 whitespace-pre-wrap">{mine.message}</p>
        </blockquote>
        {mine.status === "pending" ? (
          <div className="mt-3 text-right">
            <WithdrawRequest requestId={mine.id} accepted={false} />
          </div>
        ) : (
          <ButtonLink href="/partnere" size="sm" variant="secondary" className="mt-4 w-full">
            {t("Se andre prosjekter")}
          </ButtonLink>
        )}
      </section>
    );
  }

  if (post.closed) {
    return (
      <section className="rounded-[22px] glass-card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Lock className="size-4 text-mist" aria-hidden="true" /> {t("Lukket")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-mist">{t("Prosjektet tar ikke imot flere forespørsler.")}</p>
        <ButtonLink href="/partnere" size="sm" variant="secondary" className="mt-4 w-full">
          {t("Se andre prosjekter")}
        </ButtonLink>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] glass-card p-5">
      <h2 className="font-semibold">{t("Vil du være med?")}</h2>
      <p className="mt-2 text-sm leading-6 text-mist">
        {t("Fortell {name} hvem du er og hvor mye du vil bidra. Sier de ja, får dere hverandres e-post.", { name: first })}
      </p>
      <HelpRequestButton
        postId={post.id}
        title={post.title}
        ownerName={post.owner.name}
        commitments={post.commitments}
        loggedIn={loggedIn}
        className="mt-4 w-full"
      />
    </section>
  );
}

export default async function PartnerPostPage({ params }: Props) {
  const { id } = await params;
  const [viewer, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = makeT(locale);
  const post = await getPartnerPost(id, viewer?.id);
  if (!post) notFound();

  const pending = post.requests.filter((r) => r.status === "pending").length;

  return (
    <main className="px-5 pb-28 pt-8 md:pb-20 md:pl-28 md:pr-10 md:pt-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/partnere" className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Samarbeid")}
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:gap-12">
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={post.stage} t={t} />
              {post.closed && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 text-xs font-medium text-mist">
                  <Lock className="size-3.5" aria-hidden="true" /> {t("Lukket")}
                </span>
              )}
              <span className="text-xs text-mist" suppressHydrationWarning>
                {t("Lagt ut {time}", { time: timeAgo(post.createdAt, locale) })}
              </span>
            </div>
            <h1 className="mt-4 text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.035em]">{post.title}</h1>

            <p className="mt-6 whitespace-pre-line text-lg leading-8 text-fg/90">{post.description}</p>

            {post.needs.length > 0 && (
              <section className="mt-10">
                <h2 className="caption">{t("Trenger hjelp med")}</h2>
                <div className="mt-3">
                  <NeedChips needs={post.needs} />
                </div>
              </section>
            )}

            <section className="mt-10">
              <h2 className="caption">{t("Hva slags hjelp passer")}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {post.commitments.map((c) => (
                  <li key={c} className="rounded-[18px] glass-card p-4">
                    <p className="font-semibold">{t(COMMITMENT_LABELS[c].label)}</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-mist">{t(COMMITMENT_LABELS[c].description)}</p>
                  </li>
                ))}
              </ul>
            </section>

            {post.project && (
              <section className="mt-10">
                <h2 className="caption">{t("Prosjektet så langt")}</h2>
                <Link href={`/prosjekt/${post.project.id}`} className="group mt-3 flex items-center gap-4 rounded-[22px] glass-card p-3 transition hover:bg-card-hover">
                  {post.project.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.project.cover} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-[14px] object-cover" loading="lazy" />
                  ) : (
                    <span className="flex aspect-[4/3] w-28 shrink-0 items-center justify-center rounded-[14px] bg-fill text-mist">
                      <FolderOpen className="size-6" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold group-hover:text-ice">{post.project.title}</span>
                    <span className="text-sm text-mist">{t("Se prosjektet på Vis")}</span>
                  </span>
                  <ArrowUpRight className="mr-2 size-4 shrink-0 text-mist" aria-hidden="true" />
                </Link>
              </section>
            )}

            {post.isOwner && (
              <section id="foresporsler" className="mt-12 scroll-mt-24">
                <h2 className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
                  {t("Forespørsler")}
                  {post.requests.length > 0 && <span className="text-base font-normal text-mist tabular-nums">{post.requests.length}</span>}
                </h2>
                {pending > 0 && (
                  <p className="mt-1 text-sm text-mist">
                    {pending === 1 ? t("1 venter på svar fra deg.") : t("{n} venter på svar fra deg.", { n: pending })}
                  </p>
                )}
                {post.requests.length === 0 ? (
                  <EmptyState className="mt-4" icon={<Inbox className="size-5" />} title={t("Ingen forespørsler ennå")}>
                    {post.closed
                      ? t("Prosjektet er lukket. Åpne det igjen for å få forespørsler.")
                      : t("Når noen vil hjelpe, får du et varsel og en e-post. Del gjerne lenken til prosjektet.")}
                  </EmptyState>
                ) : (
                  <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                    {post.requests.map((r) => (
                      <RequestRow key={r.id} request={r} post={post} t={t} locale={locale} />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </article>

          <aside className="space-y-4 lg:sticky lg:top-8">
            <section className="rounded-[22px] glass-card p-5">
              <p className="caption">{post.isOwner ? t("Lagt ut av deg") : t("Lagt ut av")}</p>
              <div className="mt-4 flex items-center gap-3">
                <Link href={`/@${post.owner.username}`} className="shrink-0">
                  <Avatar name={post.owner.name} image={post.owner.image} size={48} />
                </Link>
                <div className="min-w-0">
                  <Link href={`/@${post.owner.username}`} className="block truncate font-semibold hover:text-ice">
                    {post.owner.name}
                  </Link>
                  <p className="truncate text-sm text-mist">{post.owner.headline ?? `@${post.owner.username}`}</p>
                </div>
              </div>
              {post.owner.location && (
                <p className="mt-3 flex items-center gap-2 text-sm text-mist">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" /> {post.owner.location}
                </p>
              )}
              {!post.isOwner && (
                <ButtonLink href={`/@${post.owner.username}`} variant="secondary" size="sm" className="mt-4 w-full">
                  <UserRound className="size-4" /> {t("Se profilen")}
                </ButtonLink>
              )}
            </section>

            {post.isOwner ? (
              <section className="rounded-[22px] glass-card p-5">
                <h2 className="font-semibold">{post.closed ? t("Prosjektet er lukket") : t("Prosjektet er åpent")}</h2>
                <p className="mt-2 text-sm leading-6 text-mist">
                  {post.closed
                    ? t("Det vises ikke på partnersiden eller profilen din, og ingen kan sende nye forespørsler.")
                    : t("Det vises på partnersiden og profilen din. Lukk det når du har funnet folk.")}
                </p>
                <div className="mt-4">
                  <PostOwnerActions postId={post.id} closed={post.closed} />
                </div>
              </section>
            ) : (
              <ViewerPanel post={post} loggedIn={Boolean(viewer)} t={t} locale={locale} />
            )}

            {post.interest > 0 && !post.isOwner && (
              <p className="flex items-center gap-2 px-1 text-sm text-mist">
                <Users className="size-4" aria-hidden="true" />
                {post.interest === 1 ? t("1 vil hjelpe") : t("{n} vil hjelpe", { n: post.interest })}
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
