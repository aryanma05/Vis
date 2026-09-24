import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Download, FileText, FolderPlus, MapPin, Printer, Sparkles } from "lucide-react";
import Avatar from "@/components/Avatar";
import CvView from "@/components/cv/CvView";
import CvPages from "@/components/CvPages";
import Markdown from "@/components/Markdown";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import ActivityHeatmap from "@/components/profile/ActivityHeatmap";
import { hostLabel, linkIcon } from "@/components/profile/LinkIcon";
import ProfileActions from "@/components/profile/ProfileActions";
import ProjectCard, { ProjectGrid } from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/button";
import { compactNumber, EmptyState, Tag } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import ViewTracker from "@/components/ViewTracker";
import { getActivityByDay } from "@/lib/activity";
import { ACCENTS, CV_TEMPLATE_LABELS, OPEN_TO_LABELS } from "@/lib/constants";
import { buildCvViewData } from "@/lib/cv-view";
import { formatPeriod } from "@/lib/format";
import { getOnboarding, getProfileBase, getProfileByUsername } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { shownUsername } from "@/lib/username";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ fane?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileBase(decodeURIComponent(username));
  if (!profile) return { title: "Fant ikke profilen", robots: { index: false } };
  const handle = shownUsername(profile);
  const description = profile.headline ?? profile.bio?.slice(0, 160) ?? `Prosjektene og CV-en til ${profile.name} på Vis.`;
  return {
    title: `${profile.name} (@${handle})`,
    description,
    alternates: { canonical: `/@${profile.username}` },
    openGraph: { type: "profile", title: `${profile.name} på Vis`, description, url: `/@${profile.username}`, username: handle },
    twitter: { card: "summary_large_image", title: `${profile.name} på Vis`, description },
  };
}

const monthYear = (d: Date) => d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ username }, { fane }] = await Promise.all([params, searchParams]);
  const viewer = await getCurrentUser();
  const profile = await getProfileByUsername(decodeURIComponent(username), viewer?.id);
  if (!profile) notFound();

  const tab = fane === "prosjekter" || fane === "cv" ? fane : "oversikt";
  const base = `/@${profile.username}`;
  const accent = ACCENTS[profile.accentColor ?? "is"];
  const [activity, steps] = await Promise.all([
    tab === "oversikt" ? getActivityByDay(profile.id) : null,
    profile.isOwner ? getOnboarding(profile.id, profile.username) : [],
  ]);

  const visibleProjects = profile.projects;
  const publishedCount = profile.projects.filter((p) => p.status === "published" && !p.removed).length;
  const pinned = visibleProjects.filter((p) => p.pinned);
  const featured = (pinned.length > 0 ? pinned : visibleProjects).slice(0, 4);
  const hasStructuredCv = profile.cv.experience.length + profile.cv.education.length + profile.cv.skills.length > 0;
  const hasCv = hasStructuredCv || Boolean(profile.cvDocument) || Boolean(profile.bio);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: profile.name,
      alternateName: `@${shownUsername(profile)}`,
      description: profile.headline ?? profile.bio ?? undefined,
      image: profile.image ?? undefined,
      address: profile.location ? { "@type": "PostalAddress", addressLocality: profile.location } : undefined,
      url: `${siteUrl()}${base}`,
      sameAs: [profile.websiteUrl, ...profile.links.map((l) => l.url)].filter(Boolean),
      knowsAbout: profile.cv.skills.slice(0, 20),
    },
  };

  return (
    <main style={{ "--accent": accent.color } as CSSProperties} className="pb-28 md:pb-20 md:pl-24">
      <ViewTracker kind="profile" id={profile.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Omslag: rutenett og en stripe i profilens aksentfarge. */}
      <div className="blueprint relative h-36 overflow-hidden border-b border-line md:h-52" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: `radial-gradient(80% 140% at 85% 0%, color-mix(in srgb, ${accent.color} 38%, transparent), transparent 60%)` }} />
        <div className="absolute -bottom-24 right-[8%] size-72 rounded-full border" style={{ borderColor: `color-mix(in srgb, ${accent.color} 35%, transparent)` }} />
        <div className="absolute -bottom-40 right-[4%] size-[26rem] rounded-full border" style={{ borderColor: `color-mix(in srgb, ${accent.color} 18%, transparent)` }} />
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-10 lg:grid-cols-[340px_minmax(0,1fr)] xl:gap-14">
        {/* ------------------------------------------------------------------ */}
        {/* Visittkortet                                                       */}
        {/* ------------------------------------------------------------------ */}
        <aside className="-mt-16 lg:sticky lg:top-6 lg:-mt-20 lg:self-start">
          <Avatar name={profile.name} image={profile.image} size={128} className="rounded-[32px] ring-[6px] ring-ink" />
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight md:text-[2.1rem]">{profile.name}</h1>
          <p className="mt-1 text-mist">@{shownUsername(profile)}</p>
          {profile.headline && <p className="mt-4 text-lg leading-7 text-fg">{profile.headline}</p>}

          <ul className="mt-4 space-y-1.5 text-sm text-mist">
            {profile.location && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden="true" /> {profile.location}
              </li>
            )}
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" aria-hidden="true" /> På Vis siden {monthYear(profile.createdAt)}
            </li>
          </ul>

          {profile.openTo.length > 0 && (
            <div className="mt-5 rounded-2xl border border-success/25 bg-success/[0.07] p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-medium text-success">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Åpen for
              </p>
              <p className="mt-1.5 text-sm text-fg">{profile.openTo.map((o) => OPEN_TO_LABELS[o]).join(" · ")}</p>
            </div>
          )}

          <div className="mt-6">
            <ProfileActions
              userId={profile.id}
              username={profile.username}
              name={profile.name}
              isOwner={profile.isOwner}
              isFollowing={profile.isFollowing}
              loggedIn={Boolean(viewer)}
            />
          </div>

          <dl className="mt-7 grid grid-cols-4 divide-x divide-line overflow-hidden rounded-2xl border border-line text-center">
            {[
              { label: "Prosjekter", value: publishedCount, href: `${base}?fane=prosjekter` },
              { label: "Følgere", value: profile.followers, href: `${base}/folgere` },
              { label: "Følger", value: profile.following, href: `${base}/folger` },
              { label: "Reaksjoner", value: profile.reactionsReceived },
            ].map((s) => {
              const inner = (
                <>
                  <dd className="text-lg font-bold tabular-nums tracking-tight">{compactNumber(s.value)}</dd>
                  <dt className="text-[11px] text-mist">{s.label}</dt>
                </>
              );
              return s.href ? (
                <Link key={s.label} href={s.href} className="flex flex-col-reverse px-1 py-3 transition hover:bg-surface">
                  {inner}
                </Link>
              ) : (
                <div key={s.label} className="flex flex-col-reverse px-1 py-3">
                  {inner}
                </div>
              );
            })}
          </dl>

          {(profile.websiteUrl || profile.links.length > 0) && (
            <ul className="mt-6 space-y-1">
              {[...(profile.websiteUrl ? [{ label: hostLabel(profile.websiteUrl), url: profile.websiteUrl }] : []), ...profile.links].map((link) => {
                const Icon = linkIcon(link.url);
                return (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer me"
                      className="group flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-fg/90 transition hover:bg-surface hover:text-fg"
                    >
                      <Icon className="size-4 shrink-0 text-mist group-hover:text-accent" />
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-mist opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ------------------------------------------------------------------ */}
        {/* Faner                                                              */}
        {/* ------------------------------------------------------------------ */}
        <section className="min-w-0 lg:pt-8">
          <div className="border-b border-line">
            <Tabs
              label="Profil"
              active={tab}
              items={[
                { key: "oversikt", label: "Oversikt", href: base },
                { key: "prosjekter", label: "Prosjekter", href: `${base}?fane=prosjekter`, count: visibleProjects.length },
                ...(hasCv || profile.isOwner ? [{ key: "cv", label: "CV", href: `${base}?fane=cv` }] : []),
              ]}
            />
          </div>

          <div className="pt-10">
            {tab === "oversikt" && (
              <div className="space-y-14">
                {profile.isOwner && <OnboardingChecklist steps={steps} title="Gjør ferdig profilen" />}

                {profile.lookingFor && (
                  <div className="rounded-3xl border p-6" style={{ borderColor: `color-mix(in srgb, ${accent.color} 40%, transparent)`, background: `color-mix(in srgb, ${accent.color} 7%, transparent)` }}>
                    <p className="flex items-center gap-2 label-mono">
                      <Sparkles className="size-3.5 text-accent" aria-hidden="true" /> Ser etter
                    </p>
                    <p className="mt-3 text-xl leading-8 tracking-tight text-fg">{profile.lookingFor}</p>
                  </div>
                )}

                {(profile.readme || profile.bio) && (
                  <section>
                    <h2 className="label-mono">Om meg</h2>
                    <div className="mt-4">
                      {profile.readme ? (
                        <>
                          {profile.bio && <p className="mb-6 text-xl leading-8 tracking-tight text-fg">{profile.bio}</p>}
                          <Markdown>{profile.readme}</Markdown>
                        </>
                      ) : (
                        <p className="whitespace-pre-line text-xl leading-8 tracking-tight text-fg">{profile.bio}</p>
                      )}
                    </div>
                  </section>
                )}

                <section>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="label-mono">{pinned.length > 0 ? "Festede prosjekter" : "Prosjekter"}</h2>
                    {visibleProjects.length > featured.length && (
                      <Link href={`${base}?fane=prosjekter`} className="text-sm text-mist transition hover:text-fg">
                        Alle {visibleProjects.length} <ArrowRight className="inline size-3.5" />
                      </Link>
                    )}
                  </div>
                  <div className="mt-5">
                    {featured.length > 0 ? (
                      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
                        {featured.map((p, i) => (
                          <ProjectCard key={p.id} project={p} showOwner={false} priority={i < 2} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<FolderPlus className="size-5" />}
                        title={profile.isOwner ? "Del ditt første prosjekt" : "Ingen prosjekter ennå"}
                        action={profile.isOwner ? <ButtonLink href="/ny">Del et prosjekt</ButtonLink> : undefined}
                      >
                        {profile.isOwner ? "Fra GitHub, en mappe på maskinen eller med noen bilder. Det tar et minutt." : `${profile.name} har ikke delt noe ennå.`}
                      </EmptyState>
                    )}
                  </div>
                </section>

                {activity && (
                  <section>
                    <h2 className="label-mono">Aktivitet</h2>
                    <div className="mt-5 rounded-3xl border border-line p-5">
                      <ActivityHeatmap byDay={activity.byDay} projects={activity.projects} comments={activity.comments} />
                    </div>
                  </section>
                )}

                {profile.cv.experience.length > 0 && (
                  <section>
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="label-mono">Erfaring</h2>
                      <Link href={`${base}?fane=cv`} className="text-sm text-mist transition hover:text-fg">
                        Hele CV-en <ArrowRight className="inline size-3.5" />
                      </Link>
                    </div>
                    <ol className="mt-5 divide-y divide-line border-y border-line">
                      {profile.cv.experience.slice(0, 3).map((e) => (
                        <li key={e.id} className="grid gap-1 py-5 sm:grid-cols-[160px_1fr] sm:gap-8">
                          <p className="font-mono text-xs text-mist sm:pt-1">{formatPeriod(e.startDate, e.endDate)}</p>
                          <div>
                            <p className="font-semibold text-fg">{e.title}</p>
                            <p className="text-sm text-accent">
                              {e.organization}
                              {e.location && <span className="text-mist"> · {e.location}</span>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {profile.cv.skills.length > 0 && (
                  <section>
                    <h2 className="label-mono">Kompetanse</h2>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {profile.cv.skills.map((s) => (
                        <Tag key={s} href={`/sok?type=personer&q=${encodeURIComponent(s)}`}>
                          {s}
                        </Tag>
                      ))}
                    </div>
                  </section>
                )}

                {profile.customSections.map((s) => (
                  <section key={s.id}>
                    <h2 className="label-mono">{s.title}</h2>
                    <div className="mt-4">
                      <Markdown>{s.body}</Markdown>
                    </div>
                  </section>
                ))}
              </div>
            )}

            {tab === "prosjekter" &&
              (visibleProjects.length > 0 ? (
                <ProjectGrid projects={visibleProjects} showOwner={false} columns={2} />
              ) : (
                <EmptyState
                  icon={<FolderPlus className="size-5" />}
                  title={profile.isOwner ? "Du har ingen prosjekter ennå" : "Ingen prosjekter ennå"}
                  action={profile.isOwner ? <ButtonLink href="/ny">Del et prosjekt</ButtonLink> : undefined}
                >
                  {profile.isOwner ? "Del noe du har laget, fra GitHub, en mappe eller for hånd." : undefined}
                </EmptyState>
              ))}

            {tab === "cv" &&
              (hasCv ? (
                <div className="space-y-12">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-mist">
                      Mal: <span className="font-medium text-fg">{CV_TEMPLATE_LABELS[profile.cvTemplate].name}</span>
                      {profile.isOwner && (
                        <Link href="/profil/rediger/cv" className="ml-3 text-ice hover:underline">
                          Bytt mal eller rediger
                        </Link>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <ButtonLink href={`${base}/cv`} variant="secondary" size="sm">
                        <FileText className="size-4" /> Delbar CV
                      </ButtonLink>
                      <ButtonLink href={`${base}/cv?skriv=1`} size="sm">
                        <Printer className="size-4" /> Last ned PDF
                      </ButtonLink>
                    </div>
                  </div>
                  <div className="-mx-5 overflow-hidden bg-ink-2/60 px-3 py-8 sm:mx-0 sm:rounded-3xl sm:px-8 sm:py-10">
                    <CvView data={buildCvViewData(profile)} template={profile.cvTemplate} />
                  </div>

                  {profile.cvDocument && profile.cvDocument.pages.length > 0 && (
                    <section>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2 className="label-mono">Opplastet CV</h2>
                        <a href={profile.cvDocument.fileUrl} download className="inline-flex items-center gap-2 text-sm text-ice hover:underline">
                          <Download className="size-4" /> Last ned originalen
                        </a>
                      </div>
                      {profile.isOwner && !profile.cvDocument.isPublic && <p className="mt-2 text-sm text-warn">Skjult for andre. Bare du ser den.</p>}
                      <div className="mx-auto mt-6 max-w-[820px]">
                        <CvPages pages={profile.cvDocument.pages} fileUrl={profile.cvDocument.fileUrl} name={profile.name} />
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={<FileText className="size-5" />}
                  title="Ingen CV ennå"
                  action={profile.isOwner ? <ButtonLink href="/profil/rediger/cv">Importer CV-en</ButtonLink> : undefined}
                >
                  {profile.isOwner ? "Last opp PDF-en din, så fyller vi ut erfaring, utdanning og ferdigheter." : undefined}
                </EmptyState>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
