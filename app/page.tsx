import Link from "next/link";
import { ArrowRight, Compass, MapPin } from "lucide-react";
import Avatar from "@/components/Avatar";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { ProjectGrid } from "@/components/ProjectCard";
import ProjectCover from "@/components/ProjectCover";
import ProjectFeed from "@/components/ProjectFeed";
import { PersonRow } from "@/components/social/PersonRow";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, SectionHeading, Tag } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { getFeaturedProfiles, getOnboarding, getPlatformStats } from "@/lib/profiles";
import { getFollowingProjects, getLatestProjects, getPopularTags, getTrendingProjects, type ProjectCard } from "@/lib/projects";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { getFollowCounts, suggestPeople } from "@/lib/social";

type Props = { searchParams: Promise<{ fane?: string }> };

export default async function Home({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) return <Feed user={user} searchParams={searchParams} />;
  return <Landing />;
}

/* -------------------------------------------------------------------------- */
/*  For besøkende                                                             */
/* -------------------------------------------------------------------------- */

async function Landing() {
  const [stats, featured, trending, latest] = await Promise.all([
    getPlatformStats(),
    getFeaturedProfiles(6),
    getTrendingProjects({ limit: 6 }),
    getLatestProjects({ limit: 12 }),
  ]);

  // Raden øverst viser det populære; rutenettet under det nyeste som ikke allerede står der.
  const showcase = trending;
  const fresh = latest.projects.filter((p) => !showcase.some((s) => s.id === p.id)).slice(0, 6);

  return (
    <main className="pb-24">
      <section className="px-5 pt-14 md:pl-28 md:pr-10 md:pt-24">
        <div className="fade-up mx-auto max-w-7xl">
          <h1 className="display max-w-3xl text-[clamp(2.6rem,6.4vw,5rem)]">Vis frem det du lager.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-mist md:text-xl md:leading-9">
            Prosjektene, CV-en og lenkene dine på én side. Hent prosjekter fra GitHub, eller lim inn en lenke, så tar vi
            skjermbildene for deg.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register" size="lg">
              Lag profilen din <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/sok" size="lg" variant="secondary">
              Utforsk
            </ButtonLink>
          </div>
          {stats.projects > 0 && (
            <p className="mt-8 text-sm text-mist">
              {stats.people} {stats.people === 1 ? "profil" : "profiler"} · {stats.projects} prosjekter · {stats.tags} teknologier
            </p>
          )}
        </div>
      </section>

      {showcase.length > 0 && (
        <section aria-label="Utvalgte prosjekter" className="mt-14 md:mt-16">
          <div className="edge-pad no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {showcase.map((p, i) => (
              <ShowcaseCard key={p.id} project={p} priority={i < 2} />
            ))}
          </div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="mt-24 px-5 md:mt-32 md:pl-28 md:pr-10">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              title="Nytt på Vis"
              action={
                <ButtonLink href="/sok" variant="ghost" size="sm">
                  Se alle <ArrowRight className="size-4" />
                </ButtonLink>
              }
            />
            <div className="mt-8">
              <ProjectGrid projects={fresh} />
            </div>
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mt-24 px-5 md:mt-32 md:pl-28 md:pr-10">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              title="Folk på Vis"
              action={
                <ButtonLink href="/sok?type=personer" variant="ghost" size="sm">
                  Finn flere <ArrowRight className="size-4" />
                </ButtonLink>
              }
            />
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <li key={p.username}>
                  <Link
                    href={`/@${p.username}`}
                    className="group flex h-full items-center gap-4 rounded-[22px] glass-card p-4 transition hover:bg-card-hover"
                  >
                    <Avatar name={p.name} image={p.image} size={52} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-fg">{p.name}</span>
                      <span className="block truncate text-sm text-mist">{p.headline ?? `@${p.username}`}</span>
                      <span className="mt-1 flex items-center gap-3 text-xs text-mist">
                        {p.location && (
                          <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <MapPin className="size-3 shrink-0" aria-hidden="true" /> {p.location}
                          </span>
                        )}
                        <span className="shrink-0">{p.projectCount} prosjekter</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-24 px-5 md:mt-32 md:pl-28 md:pr-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 rounded-[28px] glass-card p-8 md:p-12">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] md:text-3xl">Klar til å vise noe?</h2>
            <p className="mt-2 text-mist">Gratis, på norsk, og ferdig på et par minutter.</p>
          </div>
          <ButtonLink href="/register" size="lg">
            Lag profilen din
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}

// Stort kort i raden under toppen: bildet, med tittel og navn i en glasslapp.
function ShowcaseCard({ project, priority }: { project: ProjectCard; priority: boolean }) {
  return (
    <Link
      href={`/prosjekt/${project.id}`}
      className="group relative block aspect-[4/5] w-[78vw] max-w-[420px] shrink-0 snap-start overflow-hidden rounded-[28px] glass-card sm:aspect-[16/11] sm:w-[520px] sm:max-w-none"
    >
      {project.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.coverImageUrl}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
        />
      ) : (
        <ProjectCover title={project.title} showTitle={false} />
      )}
      <span className="glass-rim" aria-hidden="true" />
      <div className="glass-dark absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[20px] p-3">
        <Avatar name={project.owner.name} image={project.owner.image} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{project.title}</p>
          <p className="truncate text-[13px] text-white/70">{project.owner.name}</p>
        </div>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  For innloggede: strømmen                                                  */
/* -------------------------------------------------------------------------- */

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("nb-NO", { hour: "numeric", hour12: false, timeZone: "Europe/Oslo" }).format(new Date()));
  if (hour < 5) return "God natt";
  if (hour < 10) return "God morgen";
  if (hour < 17) return "Hei";
  return "God kveld";
}

async function Feed({ user, searchParams }: { user: CurrentUser; searchParams: Props["searchParams"] }) {
  const { fane } = await searchParams;
  const counts = await getFollowCounts(user.id);
  const followsAnyone = counts.following > 0;
  const tab = fane === "trender" || fane === "nyeste" || fane === "folger" ? fane : followsAnyone ? "folger" : "trender";

  const [steps, people, tags, content] = await Promise.all([
    getOnboarding(user.id, user.username),
    suggestPeople(user.id, 4),
    getPopularTags(14),
    tab === "folger"
      ? getFollowingProjects(user.id, { limit: 24 })
      : tab === "nyeste"
        ? getLatestProjects({ limit: 24 })
        : getTrendingProjects({ limit: 24 }).then((projects) => ({ projects, nextCursor: null })),
  ]);

  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <main className="px-5 pb-28 pt-6 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <h1 className="display text-[34px] md:text-5xl">
            {greeting()}, {firstName}
          </h1>
          <div className="flex gap-2">
            <ButtonLink href="/sok" variant="secondary" size="sm">
              <Compass className="size-4" /> Utforsk
            </ButtonLink>
            <ButtonLink href="/ny" size="sm">
              Del prosjekt
            </ButtonLink>
          </div>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div>
              <Tabs
                label="Strømmen"
                active={tab}
                items={[
                  { key: "folger", label: "Følger", href: "/?fane=folger" },
                  { key: "trender", label: "Populært", href: "/?fane=trender" },
                  { key: "nyeste", label: "Nyeste", href: "/?fane=nyeste" },
                ]}
              />
            </div>

            <div className="mt-8">
              {content.projects.length > 0 ? (
                <ProjectFeed
                  key={tab}
                  initial={content.projects}
                  cursor={content.nextCursor}
                  source={tab === "folger" ? "following" : "latest"}
                  columns={2}
                />
              ) : tab === "folger" ? (
                <EmptyState
                  icon={<Compass className="size-5" />}
                  title={followsAnyone ? "Ingen nye prosjekter ennå" : "Du følger ingen ennå"}
                  action={
                    <>
                      <ButtonLink href="/sok?type=personer">Finn folk å følge</ButtonLink>
                      <ButtonLink href="/?fane=trender" variant="secondary">
                        Se hva som er populært
                      </ButtonLink>
                    </>
                  }
                >
                  Følg folk du synes lager spennende ting, så dukker prosjektene deres opp her.
                </EmptyState>
              ) : (
                <EmptyState
                  title="Ingen prosjekter ennå"
                  action={<ButtonLink href="/ny">Del det første prosjektet</ButtonLink>}
                >
                  Bli den første som viser frem noe.
                </EmptyState>
              )}
            </div>
          </div>

          <aside className="space-y-8 xl:sticky xl:top-8 xl:self-start">
            <OnboardingChecklist steps={steps} />

            {people.length > 0 && (
              <section className="rounded-[22px] glass-card p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold">Folk å følge</h2>
                  <Link href="/sok?type=personer" className="text-sm text-mist hover:text-fg">
                    Se flere
                  </Link>
                </div>
                <div className="mt-5 space-y-5">
                  {people.map((p) => (
                    <PersonRow key={p.id} person={p} viewerId={user.id} compact />
                  ))}
                </div>
              </section>
            )}

            {tags.length > 0 && (
              <section>
                <h2 className="px-1 caption">Populære teknologier</h2>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Tag key={t.slug} href={`/tag/${t.slug}`} count={t.count}>
                      {t.name}
                    </Tag>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
