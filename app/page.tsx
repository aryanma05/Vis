import Link from "next/link";
import { ArrowRight, Compass, Flame, Sparkles, Users } from "lucide-react";
import ProfileAccordion from "@/components/landing/ProfileAccordion";
import { CtaBand, FeatureTrio, HowItWorks, TagMarquee } from "@/components/landing/Sections";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { ProjectGrid } from "@/components/ProjectCard";
import ProjectFeed from "@/components/ProjectFeed";
import { PersonRow } from "@/components/social/PersonRow";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, SectionHeading, Tag } from "@/components/ui/misc";
import Reveal from "@/components/ui/reveal";
import { Tabs } from "@/components/ui/tabs";
import { ACCENTS } from "@/lib/constants";
import { getFeaturedProfiles, getOnboarding, getPlatformStats } from "@/lib/profiles";
import { getFollowingProjects, getLatestProjects, getPopularTags, getTrendingProjects } from "@/lib/projects";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { getFollowCounts, suggestPeople } from "@/lib/social";
import HomeHero from "./HomeHero";

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
  const [stats, featured, trending, tags] = await Promise.all([
    getPlatformStats(),
    getFeaturedProfiles(6),
    getTrendingProjects({ limit: 6 }),
    getPopularTags(18),
  ]);

  const profiles = featured.map((p) => ({
    href: `/@${p.username}`,
    name: p.name,
    username: p.username,
    headline: p.headline,
    location: p.location,
    avatar: p.image,
    image: p.coverUrl,
    tags: p.tags,
    accent: ACCENTS[p.accentColor ?? "is"].color,
    stats: `${p.projectCount} prosjekter · ${p.followerCount} følgere`,
  }));

  return (
    <main>
      <HomeHero stats={stats} />

      {profiles.length >= 3 && (
        <section className="px-5 pb-24 pt-8 md:pb-32 md:pl-28 md:pr-10">
          <div className="mx-auto max-w-7xl">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="label-mono">Profiler på Vis</p>
                <h2 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                  Folk som viser frem <span className="serif-accent font-normal text-ice">arbeidet sitt</span>.
                </h2>
              </div>
              <ButtonLink href="/sok?type=personer" variant="outline">
                Finn flere <ArrowRight className="size-4" />
              </ButtonLink>
            </Reveal>
            <Reveal className="mt-12" delay={0.1}>
              <ProfileAccordion items={profiles} defaultIndex={Math.min(1, profiles.length - 1)} />
            </Reveal>
          </div>
        </section>
      )}

      <TagMarquee tags={tags} />
      <FeatureTrio />

      {trending.length > 0 && (
        <section className="border-t border-line px-5 py-24 md:py-32 md:pl-28 md:pr-10">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="Trender nå"
                title="Det folk ser på denne uka"
                action={
                  <ButtonLink href="/sok?sort=trending" variant="outline">
                    Se alle <ArrowRight className="size-4" />
                  </ButtonLink>
                }
              />
            </Reveal>
            <div className="mt-12">
              <ProjectGrid projects={trending} />
            </div>
          </div>
        </section>
      )}

      <HowItWorks />
      <CtaBand />
    </main>
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
    <main className="px-5 pb-28 pt-8 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label-mono">Strømmen</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
              {greeting()}, <span className="serif-accent font-normal text-ice">{firstName}</span>.
            </h1>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/sok" variant="outline" size="sm">
              <Compass className="size-4" /> Utforsk
            </ButtonLink>
            <ButtonLink href="/ny" size="sm">
              Del prosjekt
            </ButtonLink>
          </div>
        </header>

        <div className="mt-10 grid gap-12 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="border-b border-line">
              <Tabs
                label="Strømmen"
                active={tab}
                items={[
                  { key: "folger", label: <span className="inline-flex items-center gap-2"><Users className="size-4" /> Følger</span>, href: "/?fane=folger" },
                  { key: "trender", label: <span className="inline-flex items-center gap-2"><Flame className="size-4" /> Trender</span>, href: "/?fane=trender" },
                  { key: "nyeste", label: <span className="inline-flex items-center gap-2"><Sparkles className="size-4" /> Nyeste</span>, href: "/?fane=nyeste" },
                ]}
              />
            </div>

            <div className="mt-10">
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
                  icon={<Users className="size-5" />}
                  title={followsAnyone ? "Ingen nye prosjekter ennå" : "Du følger ingen ennå"}
                  action={
                    <>
                      <ButtonLink href="/sok?type=personer">Finn folk å følge</ButtonLink>
                      <ButtonLink href="/?fane=trender" variant="secondary">
                        Se hva som trender
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
              <section className="rounded-3xl border border-line p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold tracking-tight">Folk å følge</h2>
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
                <h2 className="label-mono">Populære teknologier</h2>
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
