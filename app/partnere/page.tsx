import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Hammer, Handshake, Lightbulb, MapPin, Search, UserRound, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import PartnerOptIn from "@/components/partners/PartnerOptIn";
import ContactButton from "@/components/profile/ContactButton";
import FollowButton from "@/components/social/FollowButton";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { EmptyState, Tag } from "@/components/ui/misc";
import { FIELD_KEYS, FIELDS, type FieldKey } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n";
import { findPartners, getPartnerStatus, type PartnerCard } from "@/lib/partners";
import { getCurrentUser } from "@/lib/session";

type Params = { q?: string; sted?: string; fag?: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Finn prosjektpartnere"),
    description: t("Finn utviklere, designere og andre på Vis som vil lage noe sammen med deg."),
  };
}

function readState(params: Params) {
  return {
    q: (params.q ?? "").trim().slice(0, 100),
    sted: params.sted?.trim().slice(0, 60) || "",
    fag: FIELD_KEYS.includes(params.fag as FieldKey) ? (params.fag as FieldKey) : null,
  };
}

// Lenke som beholder de andre filtrene.
function href(state: ReturnType<typeof readState>, patch: Partial<ReturnType<typeof readState>>) {
  const next = { ...state, ...patch };
  const query = new URLSearchParams();
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

// Finn noen å lage noe med: folk som har krysset av for «Samarbeid» på profilen.
export default async function PartnersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const state = readState(await searchParams);
  const [viewer, t] = await Promise.all([getCurrentUser(), getT()]);
  const [partners, status] = await Promise.all([
    findPartners({ query: state.q, location: state.sted, field: state.fag, viewerId: viewer?.id }),
    viewer ? getPartnerStatus(viewer.id) : null,
  ]);
  const filtered = Boolean(state.q || state.sted || state.fag);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <p className="caption inline-flex items-center gap-1.5">
          <Handshake className="size-3.5" aria-hidden="true" /> {t("Samarbeid")}
        </p>
        <h1 className="mt-2 display text-[clamp(2.25rem,5vw,3.5rem)]">{t("Finn noen å lage noe med")}</h1>
        <p className="mt-3 max-w-2xl text-lg text-mist">{t("Folk på Vis som vil bygge prosjekter sammen med andre.")}</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="min-w-0">
            <form action="/partnere" className="flex flex-wrap gap-2">
              {state.fag && <input type="hidden" name="fag" value={state.fag} />}
              <label className="relative min-w-56 flex-[2]">
                <span className="sr-only">{t("Søk")}</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
                <input name="q" defaultValue={state.q} placeholder={t("Ferdighet, idé eller navn")} className={`${inputClass} pl-10`} />
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

            {partners.length === 0 ? (
              <EmptyState
                className="mt-8"
                icon={<Users className="size-5" />}
                title={filtered ? t("Ingen treff") : t("Ingen her ennå")}
                action={
                  filtered ? (
                    <ButtonLink href="/partnere" variant="secondary">
                      {t("Nullstill")}
                    </ButtonLink>
                  ) : undefined
                }
              >
                {filtered ? t("Prøv et annet søk eller fagfelt.") : t("Bli den første: fortell hva du vil lage.")}
              </EmptyState>
            ) : (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {partners.map((person) => (
                  <PartnerTile key={person.id} person={person} t={t} loggedIn={Boolean(viewer)} />
                ))}
              </ul>
            )}
          </div>

          <aside className="lg:sticky lg:top-8">
            {status ? (
              <PartnerOptIn listed={status.listed} lookingFor={status.lookingFor} />
            ) : (
              <section className="rounded-[22px] glass-card p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Handshake className="size-4 text-ice" aria-hidden="true" /> {t("Vil du bli funnet?")}
                </h2>
                <p className="mt-2 text-sm text-mist">{t("Lag en profil og fortell hva du vil lage.")}</p>
                <div className="mt-4 flex gap-2">
                  <ButtonLink href="/register" size="sm">
                    {t("Lag profil")}
                  </ButtonLink>
                  <ButtonLink href="/logg-inn?neste=%2Fpartnere" size="sm" variant="secondary">
                    {t("Logg inn")}
                  </ButtonLink>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
