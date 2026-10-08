import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Code2, Eye, HandHeart, ImagePlus, MessageCircle, Sparkles, UserRound } from "lucide-react";
import Avatar from "@/components/Avatar";
import Comments from "@/components/comments/Comments";
import { GithubMark } from "@/components/icons";
import Markdown from "@/components/Markdown";
import { NeedChips } from "@/components/partners/PartnerPostTile";
import ProjectCard from "@/components/ProjectCard";
import ProjectCover from "@/components/ProjectCover";
import ProjectGallery from "@/components/ProjectGallery";
import GithubRepoPanel, { GithubRepoPanelSkeleton } from "@/components/project/GithubRepoPanel";
import ProjectMenu from "@/components/project/ProjectMenu";
import ReactionBar from "@/components/project/ReactionBar";
import ReadMore from "@/components/project/ReadMore";
import VideoEmbed from "@/components/project/VideoEmbed";
import FollowButton from "@/components/social/FollowButton";
import LeaveProject from "@/components/project/LeaveProject";
import ProjectUpdates from "@/components/project/ProjectUpdates";
import SaveToCollection from "@/components/project/SaveToCollection";
import ShareMenu from "@/components/social/ShareMenu";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { compactNumber, Tag } from "@/components/ui/misc";
import ViewTracker from "@/components/ViewTracker";
import { isActiveAdmin } from "@/lib/admin";
import { countComments } from "@/lib/comments";
import { PROGRESS_LABELS } from "@/lib/constants";
import { formatYearMonth, timeAgo } from "@/lib/format";
import { projectRepoName } from "@/lib/github";
import { getOpenPostForProject } from "@/lib/partner-posts";
import { listProjectUpdates } from "@/lib/project-updates";
import { getMoreFromOwner, getProjectById, getRelatedProjects } from "@/lib/projects";
import { getReactionSummary } from "@/lib/reactions";
import { getCurrentUser } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { isFollowing } from "@/lib/social";
import { makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import ProjectOwnerActions from "./ProjectOwnerActions";

type Props = { params: Promise<{ id: string }> };

// Omtrent hvor lenge det tar å lese beskrivelsen (200 ord i minuttet, uten kode og lenker).
function readingMinutes(markdown: string) {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w)).length;
  return Math.max(1, Math.round(words / 200));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [project, t] = await Promise.all([getProjectById(id), getT()]);
  if (!project) return { title: t("Fant ikke prosjektet"), robots: { index: false } };
  const description = project.summary ?? t("{title} av {name} på Vis.", { title: project.title, name: project.owner.name });
  return {
    title: t("{title} av {name}", { title: project.title, name: project.owner.name }),
    description,
    alternates: { canonical: `/prosjekt/${project.id}` },
    openGraph: { type: "article", title: project.title, description, url: `/prosjekt/${project.id}` },
    twitter: { card: "summary_large_image", title: project.title, description },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const [viewer, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = makeT(locale);
  const admin = isActiveAdmin(viewer);
  const project = await getProjectById(id, viewer?.id, { asAdmin: admin });
  if (!project) notFound();

  const [reactions, following, more, related, commentTotal, updates, helpWanted] = await Promise.all([
    getReactionSummary(project.id, viewer?.id),
    isFollowing(viewer?.id, project.owner.id),
    getMoreFromOwner(project.owner.id, project.id, 3),
    getRelatedProjects(project.id, project.owner.id, project.tags.map((tag) => tag.slug), 3),
    countComments(project.id),
    listProjectUpdates(project.id),
    getOpenPostForProject(project.id),
  ]);

  const date = formatYearMonth(project.projectDate, locale);
  const isMember = Boolean(viewer && project.members.some((m) => m.id === viewer.id));
  const inProgress = project.progress === "in_progress";
  const repoName = projectRepoName(project);
  const published = project.status === "published" && !project.removed;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary ?? undefined,
    url: `${siteUrl()}/prosjekt/${project.id}`,
    image: project.images[0]?.url,
    dateCreated: project.projectDate ?? undefined,
    datePublished: project.publishedAt?.toISOString(),
    keywords: project.tags.map((tag) => tag.name).join(", ") || undefined,
    author: { "@type": "Person", name: project.owner.name, url: `${siteUrl()}/@${project.owner.username}` },
    contributor: project.members.length
      ? project.members.map((m) => ({ "@type": "Person", name: m.name, url: `${siteUrl()}/@${m.username}` }))
      : undefined,
  };

  return (
    <main className="pb-28 md:pb-20 md:pl-24">
      {published && <ViewTracker kind="project" id={project.id} />}
      {published && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}

      <div className="mx-auto max-w-7xl px-5 pt-8 md:px-10 md:pt-12">
        {(project.isOwner || (admin && project.removed)) && (
          <div className="mb-8">
            {project.isOwner ? (
              <ProjectOwnerActions
                projectId={project.id}
                status={project.status}
                pinned={project.pinned}
                removed={project.removed}
                username={project.owner.username}
              />
            ) : (
              <p className="rounded-2xl border border-danger/40 bg-danger/[0.07] px-4 py-3 text-sm text-danger">
                {project.removedReason ? t("Fjernet av moderator: {reason}", { reason: project.removedReason }) : t("Fjernet av moderator.")}{" "}
                {t("Bare eieren og admin ser prosjektet.")}
              </p>
            )}
            {project.isOwner && project.removed && project.removedReason && (
              <p className="mt-2 px-1 text-sm text-mist">{t("Begrunnelse: {reason}", { reason: project.removedReason })}</p>
            )}
          </div>
        )}

        {/* Toppen: hvem, tittel, kort om, reaksjoner. */}
        <header>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-mist">
            <Link href={`/@${project.owner.username}`} className="group inline-flex items-center gap-2.5 transition hover:text-fg">
              <Avatar name={project.owner.name} image={project.owner.image} size={26} />
              <span className="font-medium text-fg/90 group-hover:text-fg">{project.owner.name}</span>
            </Link>
            {project.members.length > 0 && (
              <a href="#teamet" className="group inline-flex items-center gap-2 transition hover:text-fg">
                <span className="flex -space-x-2" aria-hidden="true">
                  {project.members.slice(0, 3).map((m) => (
                    <Avatar key={m.id} name={m.name} image={m.image} size={22} className="ring-2 ring-ink" />
                  ))}
                </span>
                <span className="text-fg/90 group-hover:text-fg">
                  {t(project.members.length === 1 ? "og {name}" : "og {n} andre", { name: project.members[0].name, n: project.members.length })}
                </span>
              </a>
            )}
            {project.publishedAt && (
              <time dateTime={project.publishedAt.toISOString()} suppressHydrationWarning>
                · {timeAgo(project.publishedAt, locale)}
              </time>
            )}
          </div>
          {(project.featured || inProgress) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.featured && (
                <p className="inline-flex items-center gap-1.5 rounded-full glass-chip px-3 py-1 text-xs font-medium text-fg">
                  <Sparkles className="size-3.5 text-warn" aria-hidden="true" /> {t("Utvalgt av redaksjonen")}
                </p>
              )}
              {inProgress && (
                <p className="inline-flex items-center gap-2 rounded-full glass-chip px-3 py-1 text-xs font-medium text-fg">
                  <span className="size-1.5 animate-pulse rounded-full bg-warn" aria-hidden="true" /> {t("Under arbeid")}
                </p>
              )}
            </div>
          )}
          <h1 className="mt-4 max-w-5xl display text-[clamp(2.25rem,5vw,4rem)]">{project.title}</h1>
          {project.summary && <p className="mt-4 max-w-3xl text-xl leading-8 text-mist md:text-[22px] md:leading-9">{project.summary}</p>}

          {/* Mobil: reaksjoner og ikonknapper på én rad, lenkene i full bredde under. */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ReactionBar projectId={project.id} initial={reactions} loggedIn={Boolean(viewer)} disabled={project.isOwner || !published} />
            <div className="ml-auto flex items-center gap-2 sm:order-last sm:ml-0">
              {published && <SaveToCollection projectId={project.id} loggedIn={Boolean(viewer)} />}
              <ShareMenu
                path={`/prosjekt/${project.id}`}
                title={project.title}
                text={project.summary ?? undefined}
                kind="prosjekt"
                projectId={project.id}
                size="md"
                iconOnly
                label={t("Del prosjektet")}
              />
              {(!project.isOwner || admin) && <ProjectMenu projectId={project.id} loggedIn={Boolean(viewer)} isAdmin={admin} featured={project.featured} />}
            </div>
            {(project.demoUrl || project.repoUrl) && (
              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                {project.demoUrl && (
                  <a href={project.demoUrl} target="_blank" rel="noreferrer" className={`${buttonClass({ size: "md" })} max-sm:flex-1`}>
                    {t("Åpne prosjektet")} <ArrowUpRight className="size-4" />
                  </a>
                )}
                {project.repoUrl && (
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className={`${buttonClass({ variant: "secondary" })} max-sm:flex-1`}>
                    {repoName ? <GithubMark className="size-4" /> : <Code2 className="size-4" />} {repoName ? "GitHub" : t("Kode")}
                  </a>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Bildene. */}
        <div className="mt-10">
          {project.images.length > 0 ? (
            <ProjectGallery images={project.images} title={project.title} />
          ) : (
            <div className="aspect-[16/8] overflow-hidden rounded-[28px]">
              <ProjectCover title={project.title} label={project.tags[0]?.name} showTitle={false}>
                {project.isOwner && (
                  <Link
                    href={`/prosjekt/${project.id}/rediger`}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center transition hover:bg-black/10"
                  >
                    <span className="glass-dark flex size-14 items-center justify-center rounded-full">
                      <ImagePlus className="size-6" />
                    </span>
                    <span className="text-2xl font-semibold text-white">{t("Legg til bilder")}</span>
                    <span className="text-sm text-white/75">
                      {t(project.demoUrl ? "Vi kan ta skjermbilder av nettsiden for deg." : "Prosjekter med bilder får langt mer oppmerksomhet.")}
                    </span>
                  </Link>
                )}
              </ProjectCover>
            </div>
          )}
        </div>

        {project.videoUrl && (
          <div className="mt-6">
            <VideoEmbed url={project.videoUrl} title={project.title} />
          </div>
        )}

        {/* Innholdet og faktaboksen. */}
        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-16">
          <div className="min-w-0 space-y-16">
            <section aria-label={t("Om prosjektet")}>
              <h2 className="caption">{t("Om prosjektet")}</h2>
              <div className="mt-5">
                {project.description.trim() ? (
                  <ReadMore minutes={readingMinutes(project.description)}>
                    <Markdown>{project.description}</Markdown>
                  </ReadMore>
                ) : project.isOwner ? (
                  <p className="text-mist">
                    {t("Ingen beskrivelse ennå.")}{" "}
                    <Link href={`/prosjekt/${project.id}/rediger`} className="text-sea underline-offset-4 hover:underline">
                      {t("Skriv hva du laget, hvorfor, og hva du lærte")}
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="text-mist">{t("{name} har ikke skrevet noe om prosjektet ennå.", { name: project.owner.name })}</p>
                )}
              </div>
            </section>

            <ProjectUpdates
              projectId={project.id}
              isOwner={project.isOwner}
              updates={updates.map((u) => ({ id: u.id, body: u.body, createdAt: u.createdAt.toISOString() }))}
            />

            <Comments projectId={project.id} viewer={viewer} isAdmin={admin} />
          </div>

          {/* Repo-panelet gjør kolonnen høy, da blir den ikke stående fast (bunnen ville vært utenfor skjermen). */}
          <aside className={`space-y-6 lg:self-start ${repoName ? "" : "lg:sticky lg:top-8"}`}>
            {/* Samarbeid: prosjektet trenger folk (/partnere), eller eieren kan be om hjelp. */}
            {helpWanted ? (
              <section className="rounded-[22px] bg-warn/10 p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-warn">
                  <HandHeart className="size-4" aria-hidden="true" /> {t("Trenger hjelp med")}
                </p>
                {helpWanted.needs.length > 0 && (
                  <div className="mt-3">
                    <NeedChips needs={helpWanted.needs} />
                  </div>
                )}
                <ButtonLink href={project.isOwner ? `/partnere/${helpWanted.id}#foresporsler` : `/partnere/${helpWanted.id}`} size="sm" className="mt-4 w-full">
                  {project.isOwner ? t("Se forespørslene") : t("Tilby hjelp")} <ArrowRight className="size-4" />
                </ButtonLink>
              </section>
            ) : (
              project.isOwner &&
              inProgress &&
              published && (
                <Link
                  href={`/partnere/ny?prosjekt=${project.id}`}
                  className="flex items-center gap-3 rounded-[22px] glass-card p-4 text-sm transition hover:bg-card-hover"
                >
                  <HandHeart className="size-5 shrink-0 text-warn" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t("Trenger du hjelp?")}</span>
                    <span className="block text-mist">{t("Finn folk som vil være med på prosjektet.")}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-mist" aria-hidden="true" />
                </Link>
              )
            )}
            <section id="teamet" className="scroll-mt-24 rounded-[22px] glass-card p-5">
              <p className="caption">{t("Laget av")}</p>
              <div className="mt-4 flex items-center gap-3">
                <Link href={`/@${project.owner.username}`} className="shrink-0">
                  <Avatar name={project.owner.name} image={project.owner.image} size={48} />
                </Link>
                <div className="min-w-0">
                  <Link href={`/@${project.owner.username}`} className="block truncate font-semibold">
                    {project.owner.name}
                  </Link>
                  <p className="truncate text-sm text-mist">{project.owner.headline ?? `@${project.owner.username}`}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {!project.isOwner && (
                  <FollowButton userId={project.owner.id} initialFollowing={following} loggedIn={Boolean(viewer)} name={project.owner.name} className="flex-1" />
                )}
                <ButtonLink href={`/@${project.owner.username}`} variant="secondary" size="sm" className="flex-1">
                  <UserRound className="size-4" /> {t("Profil")}
                </ButtonLink>
              </div>

              {project.members.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="caption">{t("Sammen med")}</p>
                  <ul className="mt-3 space-y-3">
                    {project.members.map((m) => (
                      <li key={m.id}>
                        <Link href={`/@${m.username}`} className="group flex items-center gap-3">
                          <Avatar name={m.name} image={m.image} size={36} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-fg underline-offset-4 group-hover:underline">{m.name}</span>
                            <span className="block truncate text-[13px] text-mist">{m.headline ?? `@${m.username}`}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {isMember && (
                    <div className="mt-3">
                      <LeaveProject projectId={project.id} owner={project.owner.name} />
                    </div>
                  )}
                </div>
              )}
            </section>

            <dl className="space-y-4 rounded-[22px] glass-card p-5 text-sm">
              <div>
                <dt className="caption">{t("Status")}</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-fg">
                  <span className={`size-2 rounded-full ${inProgress ? "bg-warn" : "bg-success"}`} aria-hidden="true" /> {t(PROGRESS_LABELS[project.progress])}
                </dd>
              </div>
              {project.role && (
                <div>
                  <dt className="caption">{t("Rolle")}</dt>
                  <dd className="mt-1.5 text-fg">{project.role}</dd>
                </div>
              )}
              {date && (
                <div>
                  <dt className="caption">{t(inProgress ? "Startet" : "Laget")}</dt>
                  <dd className="mt-1.5 flex items-center gap-2 text-fg">
                    <CalendarDays className="size-4 text-mist" aria-hidden="true" /> {date}
                  </dd>
                </div>
              )}
              {project.tags.length > 0 && (
                <div>
                  <dt className="caption">{t("Laget med")}</dt>
                  <dd className="mt-2.5 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <Tag key={tag.slug} href={`/tag/${tag.slug}`}>
                        {tag.name}
                      </Tag>
                    ))}
                  </dd>
                </div>
              )}
              {(project.demoUrl || project.repoUrl || project.githubFullName) && (
                <div>
                  <dt className="caption">{t("Lenker")}</dt>
                  <dd className="mt-2 space-y-1.5">
                    {project.demoUrl && (
                      <a href={project.demoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-sea hover:underline">
                        <ArrowUpRight className="size-4 shrink-0" /> {project.demoUrl.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                    {project.repoUrl && (
                      <a href={project.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-sea hover:underline">
                        {repoName ? <GithubMark className="size-4 shrink-0" /> : <Code2 className="size-4 shrink-0" />}{" "}
                        {repoName ?? project.repoUrl.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                  </dd>
                </div>
              )}
              <div className="flex gap-6 border-t border-line pt-4 text-mist">
                <span className="inline-flex items-center gap-1.5" title={t("Visninger")}>
                  <Eye className="size-4" /> {t("{n} visninger", { n: compactNumber(project.viewCount) })}
                </span>
                <a href="#kommentarer" className="inline-flex items-center gap-1.5 hover:text-fg" title={t("Kommentarer")}>
                  <MessageCircle className="size-4" /> {commentTotal}
                </a>
              </div>
            </dl>

            {repoName && (
              <Suspense fallback={<GithubRepoPanelSkeleton />}>
                <GithubRepoPanel fullName={repoName} projectId={project.id} isOwner={project.isOwner} />
              </Suspense>
            )}
          </aside>
        </div>

        {more.length > 0 && (
          <section className="mt-24 border-t border-line pt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-[-0.025em]">{t("Mer fra {name}", { name: project.owner.name.split(" ")[0] })}</h2>
              <Link href={`/@${project.owner.username}?fane=prosjekter`} className="text-sm text-mist hover:text-fg">
                {t("Alle prosjekter")} <ArrowRight className="inline size-3.5" />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((p) => (
                <ProjectCard key={p.id} project={p} showOwner={false} />
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-bold tracking-[-0.025em]">{t("Lignende prosjekter")}</h2>
            <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
