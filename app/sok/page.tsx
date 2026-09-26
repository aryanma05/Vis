import type { Metadata } from "next";
import { SearchX, Users } from "lucide-react";
import { ProjectGrid } from "@/components/ProjectCard";
import { PersonTile } from "@/components/social/PersonRow";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Tag } from "@/components/ui/misc";
import { OPEN_TO, OPEN_TO_LABELS, type OpenTo } from "@/lib/constants";
import { getPopularLocations, searchPeople } from "@/lib/profiles";
import { getPopularTags, getTagBySlug, searchProjects, type ProjectSort } from "@/lib/projects";
import { getCurrentUser } from "@/lib/session";
import ExploreFilters, { type ExploreSort, type ExploreType } from "./ExploreFilters";

type Params = { q?: string; tag?: string; sort?: string; type?: string; sted?: string; apen?: string };
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
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const state = readState(await searchParams);
  const subject = state.q || (state.tag ? (await getTagBySlug(state.tag))?.name : null);
  if (state.type === "personer") return { title: subject ? `${subject} – folk på Vis` : "Finn folk", description: "Finn utviklere, designere og andre som lager digitalt i Norden." };
  return {
    title: subject ? `${subject} – prosjekter` : "Utforsk prosjekter",
    description: "Søk i prosjekter fra utviklere og designere i Norden, filtrer på teknologi og se hva som trender.",
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const state = readState(await searchParams);
  const viewer = await getCurrentUser();

  const [tags, activeTag, locations] = await Promise.all([
    getPopularTags(40),
    state.tag ? getTagBySlug(state.tag) : null,
    state.type === "personer" ? getPopularLocations(10) : Promise.resolve([]),
  ]);
  // Valgt teknologi skal vises selv om den ikke er blant de mest brukte.
  const tagList = activeTag && !tags.some((t) => t.slug === activeTag.slug) ? [{ ...activeTag, count: 0 }, ...tags] : tags;

  const projects =
    state.type === "prosjekter"
      ? await searchProjects(state.q, { tag: state.tag, sort: (state.q || state.sort !== "relevant" ? state.sort : "newest") as ProjectSort })
      : [];
  const people =
    state.type === "personer"
      ? await searchPeople(state.q, { viewerId: viewer?.id, location: state.sted, openTo: state.apen, tag: state.tag })
      : [];

  const count = state.type === "prosjekter" ? projects.length : people.length;
  const searching = Boolean(state.q || state.tag || state.sted || state.apen);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <p className="label-mono">Utforsk</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          {state.type === "personer" ? (
            <>
              Finn folk som <span className="serif-accent font-normal text-ice">lager</span> ting.
            </>
          ) : (
            <>
              Finn prosjekter å bli <span className="serif-accent font-normal text-ice">inspirert</span> av.
            </>
          )}
        </h1>

        <div className="mt-10">
          <ExploreFilters state={state} tags={tagList} locations={locations} />
        </div>

        {state.type === "prosjekter" && !state.tag && tagList.length > 0 && (
          <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
            {tagList.slice(0, 18).map((t) => (
              <Tag key={t.slug} href={`/sok?tag=${encodeURIComponent(t.slug)}`} count={t.count}>
                {t.name}
              </Tag>
            ))}
          </div>
        )}

        <div className="mt-12">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-4">
            <h2 className="text-lg font-medium">
              {searching ? (
                <>
                  {count} {count === 1 ? "treff" : "treff"}
                  {state.q && (
                    <>
                      {" "}
                      for <span className="text-ice">«{state.q}»</span>
                    </>
                  )}
                  {activeTag && (
                    <>
                      {" "}
                      i <span className="text-ice">{activeTag.name}</span>
                    </>
                  )}
                  {state.sted && <> i {state.sted}</>}
                  {state.apen && <> · åpne for {OPEN_TO_LABELS[state.apen].toLowerCase()}</>}
                </>
              ) : state.type === "personer" ? (
                "Folk på Vis"
              ) : (
                "Nyeste prosjekter"
              )}
            </h2>
            {state.tag && <ButtonLink href={`/tag/${state.tag}`} variant="link">Se siden for {activeTag?.name ?? state.tag}</ButtonLink>}
          </div>

          {state.type === "prosjekter" ? (
            projects.length > 0 ? (
              <ProjectGrid projects={projects} />
            ) : (
              <EmptyState icon={<SearchX className="size-5" />} title="Ingen prosjekter passet søket">
                Prøv et annet ord, fjern et filter, eller søk etter personer i stedet.
              </EmptyState>
            )
          ) : people.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {people.map((p) => (
                <PersonTile key={p.id} person={p} viewerId={viewer?.id} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Users className="size-5" />} title="Fant ingen som passet">
              Prøv et annet navn, sted eller en ferdighet.
            </EmptyState>
          )}
        </div>
      </div>
    </main>
  );
}
