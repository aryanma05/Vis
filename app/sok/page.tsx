import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Users } from "lucide-react";
import ProjectMasonry from "@/components/ProjectMasonry";
import { PersonTile } from "@/components/social/PersonRow";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Tag } from "@/components/ui/misc";
import { FIELD_KEYS, OPEN_TO, OPEN_TO_LABELS, PERIODS, type FieldKey, type OpenTo, type PeriodKey } from "@/lib/constants";
import { getPopularLocations, searchPeople } from "@/lib/profiles";
import { getPopularTags, getTagBySlug, searchProjects, type ProjectSort } from "@/lib/projects";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import ExploreFilters, { type ExploreSort, type ExploreType } from "./ExploreFilters";

type Params = { q?: string; tag?: string; sort?: string; type?: string; sted?: string; apen?: string; fag?: string; periode?: string; utvalgt?: string };
type Props = { searchParams: Promise<Params> };

const SORTS: ExploreSort[] = ["relevant", "newest", "trending", "popular", "discussed", "az"];

function readState(params: Params) {
  const type: ExploreType = params.type === "personer" ? "personer" : "prosjekter";
  return {
    q: (params.q ?? "").trim().slice(0, 100),
    type,
    tag: params.tag?.trim().slice(0, 60) || null,
    sort: SORTS.includes(params.sort as ExploreSort) ? (params.sort as ExploreSort) : ("relevant" as ExploreSort),
    sted: params.sted?.trim().slice(0, 60) || null,
    apen: OPEN_TO.includes(params.apen as OpenTo) ? (params.apen as OpenTo) : null,
    fag: FIELD_KEYS.includes(params.fag as FieldKey) ? (params.fag as FieldKey) : null,
    periode: params.periode && params.periode in PERIODS ? (params.periode as PeriodKey) : null,
    utvalgt: params.utvalgt === "1",
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [state, t] = await Promise.all([searchParams.then(readState), getT()]);
  const subject = state.q || (state.tag ? (await getTagBySlug(state.tag))?.name : null);
  if (state.type === "personer")
    return {
      title: subject ? t("{subject} – folk på Vis", { subject }) : t("Finn folk"),
      description: t("Finn utviklere, designere og andre som lager digitalt i Norden."),
    };
  return {
    title: subject ? t("{subject} – prosjekter", { subject }) : t("Utforsk prosjekter"),
    description: t("Søk i prosjekter fra utviklere og designere i Norden, filtrer på teknologi og se hva som trender."),
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const state = readState(await searchParams);
  const [viewer, t] = await Promise.all([getCurrentUser(), getT()]);

  const [tags, activeTag, locations] = await Promise.all([
    getPopularTags(40),
    state.tag ? getTagBySlug(state.tag) : null,
    state.type === "personer" ? getPopularLocations(10) : Promise.resolve([]),
  ]);
  // Valgt teknologi skal vises selv om den ikke er blant de mest brukte.
  const tagList = activeTag && !tags.some((tag) => tag.slug === activeTag.slug) ? [{ ...activeTag, count: 0 }, ...tags] : tags;

  const projects =
    state.type === "prosjekter"
      ? await searchProjects(state.q, {
          tag: state.tag,
          sort: (state.q || state.sort !== "relevant" ? state.sort : "newest") as ProjectSort,
          field: state.fag,
          period: state.periode,
          featuredOnly: state.utvalgt,
        })
      : [];
  const people =
    state.type === "personer"
      ? await searchPeople(state.q, { viewerId: viewer?.id, location: state.sted, openTo: state.apen, tag: state.tag, field: state.fag })
      : [];

  const count = state.type === "prosjekter" ? projects.length : people.length;
  const searching = Boolean(state.q || state.tag || state.sted || state.apen || state.fag || state.periode || state.utvalgt);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="display text-[34px] md:text-5xl">{t("Utforsk")}</h1>
          <Link href="/stillinger" className="text-sm text-mist transition hover:text-fg">
            {t("Ledige stillinger →")}
          </Link>
        </div>

        <div className="mt-6">
          <ExploreFilters state={state} tags={tagList} locations={locations} />
        </div>

        {state.type === "prosjekter" && !state.tag && tagList.length > 0 && (
          <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
            {tagList.slice(0, 18).map((tag) => (
              <Tag key={tag.slug} href={`/sok?tag=${encodeURIComponent(tag.slug)}`} count={tag.count}>
                {tag.name}
              </Tag>
            ))}
          </div>
        )}

        <div className="mt-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">
              {searching ? (
                <>
                  {t(count === 1 ? "1 treff" : "{n} treff", { n: count })}
                  {state.q && ` ${t("for «{q}»", { q: state.q })}`}
                  {activeTag && ` ${t("i {place}", { place: activeTag.name })}`}
                  {state.sted && ` ${t("i {place}", { place: state.sted })}`}
                  {state.apen && ` · ${t("åpne for {what}", { what: t(OPEN_TO_LABELS[state.apen]).toLowerCase() })}`}
                </>
              ) : state.type === "personer" ? (
                t("Folk på Vis")
              ) : (
                t("Nyeste prosjekter")
              )}
            </h2>
            {state.tag && <ButtonLink href={`/tag/${state.tag}`} variant="link">{t("Se siden for {name}", { name: activeTag?.name ?? state.tag })}</ButtonLink>}
          </div>

          {state.type === "prosjekter" ? (
            projects.length > 0 ? (
              <ProjectMasonry projects={projects} />
            ) : (
              <EmptyState icon={<SearchX className="size-5" />} title={t("Ingen prosjekter passet søket")}>
                {t("Prøv et annet ord, fjern et filter, eller søk etter personer i stedet.")}
              </EmptyState>
            )
          ) : people.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {people.map((p) => (
                <PersonTile key={p.id} person={p} viewerId={viewer?.id} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Users className="size-5" />} title={t("Fant ingen som passet")}>
              {t("Prøv et annet navn, sted eller en ferdighet.")}
            </EmptyState>
          )}
        </div>
      </div>
    </main>
  );
}
