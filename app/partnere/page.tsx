import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Hammer, Handshake, Lightbulb, MapPin, Plus, Search, Send, UserRound, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import PartnerPostTile from "@/components/partners/PartnerPostTile";
import ContactButton from "@/components/profile/ContactButton";
import FollowButton from "@/components/social/FollowButton";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { EmptyState, Tag } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { FIELD_KEYS, FIELDS, type FieldKey } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n";
import { listMyPosts, listMySentRequests, listPartnerPosts } from "@/lib/partner-posts";
import { findPartners, type PartnerCard } from "@/lib/partners";
import { getCurrentUser } from "@/lib/session";

type Params = { q?: string; sted?: string; fag?: string; vis?: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Finn prosjektpartnere"),
    description: t("Legg ut en idé eller et påbegynt prosjekt og få hjelp, eller bli med på noe andre lager på Vis."),
  };
}

function readState(params: Params) {
  return {
    vis: params.vis === "folk" ? ("folk" as const) : ("prosjekter" as const),
    q: (params.q ?? "").trim().slice(0, 100),
    sted: params.sted?.trim().slice(0, 60) || "",
    fag: FIELD_KEYS.includes(params.fag as FieldKey) ? (params.fag as FieldKey) : null,
  };
}

type State = ReturnType<typeof readState>;

// Lenke som beholder de andre filtrene.
function href(state: State, patch: Partial<State>) {
  const next = { ...state, ...patch };
  const query = new URLSearchParams();
  if (next.vis === "folk") query.set("vis", "folk");
  if (next.q) query.set("q", next.q);
  if (next.sted) query.set("sted", next.sted);
  if (next.fag) query.set("fag", next.fag);
  const s = query.toString();
  return s ? `/partnere?${s}` : "/partnere";
}

function PartnerTile({ person, t, loggedIn }: { person: PartnerCard; t: T; loggedIn: boolean }) {
  return (
    <li className="flex flex-col rounded-[22px] glass-card p-5">
      <div className="flex items-start gap-3">
        <Link href={`/@${person.username}`} className="shrink-0">
          <Avatar name={person.name} image={person.image} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/@${person.username}`} className="block truncate font-semibold hover:text-ice">
            {person.name}
          </Link>
          <p className="truncate text-sm text-mist">{person.headline ?? `@${person.username}`}</p>
        </div>
      </div>

      {person.lookingFor && (
        <p className="mt-4 flex gap-2.5 text-[15px] leading-6 text-fg/90">
          <Lightbulb className="mt-1 size-4 shrink-0 text-warn" aria-label={t("Ser etter")} />
          <span className="line-clamp-4">{person.lookingFor}</span>
        </p>
      )}

      <ul className="mt-4 space-y-1.5 text-[13px] text-mist">
        {person.current && (
          <li className="flex items-center gap-2">
            <Hammer className="size-3.5 shrink-0" aria-label={t("Jobber med")} />
            <Link href={`/prosjekt/${person.current.id}`} className="truncate hover:text-fg">
              {person.current.title}
            </Link>
          </li>
        )}
        {person.location && (
          <li className="flex items-center gap-2">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{person.location}</span>
          </li>
        )}
        {person.projectCount > 0 && (
          <li className="flex items-center gap-2">
            <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
            {person.projectCount === 1 ? t("1 prosjekt") : t("{n} prosjekter", { n: person.projectCount })}
          </li>
        )}
      </ul>

      {person.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {person.skills.map((skill) => (
            <Tag key={skill} size="xs">
              {skill}
            </Tag>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {person.contactEnabled ? (
          <ContactButton recipientId={person.id} name={person.name} loggedIn={loggedIn} defaultReason="samarbeid" />
        ) : (
          <FollowButton userId={person.id} initialFollowing={person.isFollowing} loggedIn={loggedIn} name={person.name} />
        )}
        <ButtonLink href={`/@${person.username}`} variant="ghost" size="sm">
          <UserRound className="size-4" /> {t("Profil")}
        </ButtonLink>
      </div>
    </li>
  );
}

const STATUS_TONE = { pending: "text-mist", accepted: "text-success", declined: "text-mist/70" } as const;
const STATUS_LABEL = { pending: "Venter på svar", accepted: "Du er med", declined: "Ikke denne gangen" } as const;

// Det innlogget bruker har på gang: egne utlysninger (med ubesvarte forespørsler) og
// forespørslene man har sendt. Vises bare når det er noe der.
function MySide({
  posts,
  sent,
  t,
}: {
  posts: Awaited<ReturnType<typeof listMyPosts>>;
  sent: Awaited<ReturnType<typeof listMySentRequests>>;
  t: T;
}) {
  return (
    <section className="rounded-[22px] glass-card p-5">
      {posts.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-warn" aria-hidden="true" /> {t("Dine prosjekter")}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/partnere/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-ice">
                  <span className={`min-w-0 truncate ${p.closed ? "text-mist" : "font-medium"}`}>{p.title}</span>
                  {p.closed ? (
                    <span className="shrink-0 text-xs text-mist">{t("Lukket")}</span>
                  ) : p.pending > 0 ? (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary" title={t("Ubesvarte forespørsler")}>
                      {p.pending}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sent.length > 0 && (
        <div className={posts.length > 0 ? "mt-4 border-t border-line pt-4" : ""}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Send className="size-4 text-ice" aria-hidden="true" /> {t("Dine forespørsler")}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {sent.map((r) => (
              <li key={r.id}>
                <Link href={`/partnere/${r.postId}`} className="block py-2.5 text-sm hover:text-ice">
                  <span className="block truncate font-medium">{r.postTitle}</span>
                  <span className={`block text-xs ${STATUS_TONE[r.status]}`}>
                    {r.ownerName} · {t(STATUS_LABEL[r.status])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Samarbeid: prosjekter som trenger hjelp, og folk som vil lage noe sammen med andre.
export default async function PartnersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const state = readState(await searchParams);
  const [viewer, t] = await Promise.all([getCurrentUser(), getT()]);
  const filters = { query: state.q, location: state.sted, field: state.fag, viewerId: viewer?.id };
  const [posts, partners, myPosts, mySent] = await Promise.all([
    state.vis === "prosjekter" ? listPartnerPosts(filters) : null,
    state.vis === "folk" ? findPartners(filters) : null,
    viewer ? listMyPosts(viewer.id) : [],
    viewer ? listMySentRequests(viewer.id) : [],
  ]);
  const filtered = Boolean(state.q || state.sted || state.fag);
  const newHref = viewer ? "/partnere/ny" : `/logg-inn?neste=${encodeURIComponent("/partnere/ny")}`;
  // Uten noe å følge med på får listen hele bredden.
  const hasSide = myPosts.length > 0 || mySent.length > 0;
  const listClass = `mt-8 grid gap-4 sm:grid-cols-2 ${hasSide ? "" : "lg:grid-cols-3"}`;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="caption inline-flex items-center gap-1.5">
              <Handshake className="size-3.5" aria-hidden="true" /> {t("Samarbeid")}
            </p>
            <h1 className="mt-2 display text-[clamp(2.25rem,5vw,3.5rem)]">{t("Finn noen å lage noe med")}</h1>
            <p className="mt-3 max-w-2xl text-lg text-mist">
              {t("Legg ut en idé eller et påbegynt prosjekt og si hva du trenger hjelp med, eller bli med på noe andre lager.")}
            </p>
          </div>
          <ButtonLink href={newHref}>
            <Plus className="size-4" /> {t("Legg ut et prosjekt")}
          </ButtonLink>
        </div>

        <div className={`mt-8 grid gap-6 lg:items-start ${hasSide ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
          <div className="min-w-0">
            <Tabs
              label={t("Prosjekter eller folk")}
              active={state.vis}
              items={[
                { key: "prosjekter", label: t("Prosjekter som trenger hjelp"), href: href(state, { vis: "prosjekter" }) },
                { key: "folk", label: t("Folk"), href: href(state, { vis: "folk" }) },
              ]}
            />

            <form action="/partnere" className="mt-5 flex flex-wrap gap-2">
              {state.vis === "folk" && <input type="hidden" name="vis" value="folk" />}
              {state.fag && <input type="hidden" name="fag" value={state.fag} />}
              <label className="relative min-w-56 flex-[2]">
                <span className="sr-only">{t("Søk")}</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={state.q}
                  placeholder={state.vis === "folk" ? t("Ferdighet, idé eller navn") : t("Idé, rolle eller teknologi")}
                  className={`${inputClass} pl-10`}
                />
              </label>
              <label className="relative min-w-40 flex-1">
                <span className="sr-only">{t("Sted")}</span>
                <MapPin className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
                <input name="sted" defaultValue={state.sted} placeholder={t("Sted")} className={`${inputClass} pl-10`} />
              </label>
              <button type="submit" className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition hover:opacity-90">
                {t("Søk")}
              </button>
            </form>

            <nav aria-label={t("Fagfelt")} className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
              <Tag href={href(state, { fag: null })} active={!state.fag}>
                {t("Alle")}
              </Tag>
              {FIELD_KEYS.map((key) => (
                <Tag key={key} href={href(state, { fag: key })} active={state.fag === key}>
                  {t(FIELDS[key].label)}
                </Tag>
              ))}
            </nav>

            {posts &&
              (posts.length === 0 ? (
                <EmptyState
                  className="mt-8"
                  icon={<Lightbulb className="size-5" />}
                  title={filtered ? t("Ingen treff") : t("Ingen prosjekter her ennå")}
                  action={
                    filtered ? (
                      <ButtonLink href={href(state, { q: "", sted: "", fag: null })} variant="secondary">
                        {t("Nullstill")}
                      </ButtonLink>
                    ) : undefined
                  }
                >
                  {filtered ? t("Prøv et annet søk eller fagfelt.") : t("Bli den første: legg ut en idé eller noe du har begynt på, og si hva du trenger hjelp med.")}
                </EmptyState>
              ) : (
                <ul className={listClass}>
                  {posts.map((post) => (
                    <PartnerPostTile key={post.id} post={post} t={t} viewerId={viewer?.id} />
                  ))}
                </ul>
              ))}

            {partners &&
              (partners.length === 0 ? (
                <EmptyState
                  className="mt-8"
                  icon={<Users className="size-5" />}
                  title={filtered ? t("Ingen treff") : t("Ingen her ennå")}
                  action={
                    filtered ? (
                      <ButtonLink href={href(state, { q: "", sted: "", fag: null })} variant="secondary">
                        {t("Nullstill")}
                      </ButtonLink>
                    ) : undefined
                  }
                >
                  {filtered ? t("Prøv et annet søk eller fagfelt.") : t("Kryss av for «Samarbeid» under «Åpen for» på profilen din, så vises du her.")}
                </EmptyState>
              ) : (
                <ul className={listClass}>
                  {partners.map((person) => (
                    <PartnerTile key={person.id} person={person} t={t} loggedIn={Boolean(viewer)} />
                  ))}
                </ul>
              ))}
          </div>

          {hasSide && (
            <aside className="lg:sticky lg:top-8">
              <MySide posts={myPosts} sent={mySent} t={t} />
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
