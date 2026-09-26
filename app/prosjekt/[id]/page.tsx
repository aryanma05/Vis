import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarDays, Code2, Eye, ImagePlus, MessageCircle, UserRound } from "lucide-react";
import Avatar from "@/components/Avatar";
import Comments from "@/components/comments/Comments";
import Markdown from "@/components/Markdown";
import ProjectCard from "@/components/ProjectCard";
import ProjectCover from "@/components/ProjectCover";
import ProjectGallery from "@/components/ProjectGallery";
import ProjectMenu from "@/components/project/ProjectMenu";
import ReactionBar from "@/components/project/ReactionBar";
import VideoEmbed from "@/components/project/VideoEmbed";
import FollowButton from "@/components/social/FollowButton";
import ShareButton from "@/components/social/ShareButton";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { compactNumber, Tag } from "@/components/ui/misc";
import ViewTracker from "@/components/ViewTracker";
import { isAdmin } from "@/lib/admin";
import { countComments } from "@/lib/comments";
import { formatYearMonth, timeAgo } from "@/lib/format";
import { getMoreFromOwner, getProjectById, getRelatedProjects } from "@/lib/projects";
import { getReactionSummary } from "@/lib/reactions";
import { getCurrentUser } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { isFollowing } from "@/lib/social";
import ProjectOwnerActions from "./ProjectOwnerActions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return { title: "Fant ikke prosjektet", robots: { index: false } };
  const description = project.summary ?? `${project.title} av ${project.owner.name} på Vis.`;
  return {
    title: `${project.title} av ${project.owner.name}`,
    description,
    alternates: { canonical: `/prosjekt/${project.id}` },
    openGraph: { type: "article", title: project.title, description, url: `/prosjekt/${project.id}` },
    twitter: { card: "summary_large_image", title: project.title, description },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const admin = isAdmin(viewer);
  const project = await getProjectById(id, viewer?.id, { asAdmin: admin });
  if (!project) notFound();

  const [reactions, following, more, related, commentTotal] = await Promise.all([
    getReactionSummary(project.id, viewer?.id),
    isFollowing(viewer?.id, project.owner.id),
    getMoreFromOwner(project.owner.id, project.id, 3),
    getRelatedProjects(project.id, project.owner.id, project.tags.map((t) => t.slug), 3),
    countComments(project.id),
  ]);

  const date = formatYearMonth(project.projectDate);
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
    keywords: project.tags.map((t) => t.name).join(", ") || undefined,
    author: { "@type": "Person", name: project.owner.name, url: `${siteUrl()}/@${project.owner.username}` },
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
                Fjernet av moderator{project.removedReason ? `: ${project.removedReason}` : "."} Bare eieren og admin ser prosjektet.
              </p>
            )}
            {project.isOwner && project.removed && project.removedReason && (
              <p className="mt-2 px-1 text-sm text-mist">Begrunnelse: {project.removedReason}</p>
            )}
          </div>
        )}

        {/* Toppen: hvem, tittel, kort om, reaksjoner. */}
        <header>
          <Link href={`/@${project.owner.username}`} className="group inline-flex items-center gap-2.5 text-sm text-mist transition hover:text-fg">
            <Avatar name={project.owner.name} image={project.owner.image} size={26} />
            <span className="font-medium text-fg/90 group-hover:text-fg">{project.owner.name}</span>
            {project.publishedAt && (
              <time dateTime={project.publishedAt.toISOString()} suppressHydrationWarning className="text-mist/70">
                · {timeAgo(project.publishedAt)}
              </time>
            )}
          </Link>
          <h1 className="mt-5 max-w-5xl display text-[clamp(2.6rem,6.5vw,5.5rem)]">{project.title}</h1>
          {project.summary && <p className="mt-5 max-w-3xl text-xl leading-8 text-fg/80 md:text-2xl md:leading-9">{project.summary}</p>}

          {/* Mobil: reaksjoner og ikonknapper på én rad, lenkene i full bredde under. */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ReactionBar projectId={project.id} initial={reactions} loggedIn={Boolean(viewer)} disabled={project.isOwner || !published} />
            <div className="ml-auto flex items-center gap-2 sm:order-last sm:ml-0">
              <ShareButton path={`/prosjekt/${project.id}`} title={project.title} text={project.summary ?? undefined} variant="secondary" size="md" iconOnly label="Kopier lenke" />
              {!project.isOwner && <ProjectMenu projectId={project.id} loggedIn={Boolean(viewer)} isAdmin={admin} />}
            </div>
            {(project.demoUrl || project.repoUrl) && (
              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                {project.demoUrl && (
                  <a href={project.demoUrl} target="_blank" rel="noreferrer" className={`${buttonClass({ size: "md" })} max-sm:flex-1`}>
                    Åpne prosjektet <ArrowUpRight className="size-4" />
                  </a>
                )}
                {project.repoUrl && (
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className={`${buttonClass({ variant: "secondary" })} max-sm:flex-1`}>
                    <Code2 className="size-4" /> Kode
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
            <div className="aspect-[16/8] overflow-hidden rounded-3xl ring-1 ring-line">
              <ProjectCover title={project.title} label={project.tags[0]?.name} showTitle={false}>
                {project.isOwner && (
                  <Link
                    href={`/prosjekt/${project.id}/rediger`}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center transition hover:bg-black/10"
                  >
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur">
                      <ImagePlus className="size-6" />
                    </span>
                    <span className="text-2xl font-semibold text-white">Legg til bilder</span>
                    <span className="text-sm text-white/75">Prosjekter med bilder får langt mer oppmerksomhet.</span>
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
        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-16">
          <div className="min-w-0 space-y-16">
            <section aria-label="Om prosjektet">
              <h2 className="label-mono">Om prosjektet</h2>
              <div className="mt-5">
                {project.description.trim() ? (
                  <Markdown>{project.description}</Markdown>
                ) : project.isOwner ? (
                  <p className="text-mist">
                    Ingen beskrivelse ennå.{" "}
                    <Link href={`/prosjekt/${project.id}/rediger`} className="text-ice underline-offset-4 hover:underline">
                      Skriv hva du laget, hvorfor, og hva du lærte
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="text-mist">{project.owner.name} har ikke skrevet noe om prosjektet ennå.</p>
                )}
              </div>
            </section>

            <Comments projectId={project.id} viewer={viewer} isAdmin={admin} />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-3xl border border-line bg-surface/50 p-5">
              <p className="label-mono">Laget av</p>
              <div className="mt-4 flex items-center gap-3">
                <Link href={`/@${project.owner.username}`} className="shrink-0">
                  <Avatar name={project.owner.name} image={project.owner.image} size={48} />
                </Link>
                <div className="min-w-0">
                  <Link href={`/@${project.owner.username}`} className="block truncate font-semibold hover:text-ice">
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
                  <UserRound className="size-4" /> Profil
                </ButtonLink>
              </div>
            </section>

            <dl className="space-y-4 rounded-3xl border border-line p-5 text-sm">
              {project.role && (
                <div>
                  <dt className="label-mono">Rolle</dt>
                  <dd className="mt-1.5 text-fg">{project.role}</dd>
                </div>
              )}
              {date && (
                <div>
                  <dt className="label-mono">Laget</dt>
                  <dd className="mt-1.5 flex items-center gap-2 text-fg">
                    <CalendarDays className="size-4 text-mist" aria-hidden="true" /> {date}
                  </dd>
                </div>
              )}
              {project.tags.length > 0 && (
                <div>
                  <dt className="label-mono">Laget med</dt>
                  <dd className="mt-2.5 flex flex-wrap gap-1.5">
                    {project.tags.map((t) => (
                      <Tag key={t.slug} href={`/tag/${t.slug}`}>
                        {t.name}
                      </Tag>
                    ))}
                  </dd>
                </div>
              )}
              {(project.demoUrl || project.repoUrl || project.githubFullName) && (
                <div>
                  <dt className="label-mono">Lenker</dt>
                  <dd className="mt-2 space-y-1.5">
                    {project.demoUrl && (
                      <a href={project.demoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-ice hover:underline">
                        <ArrowUpRight className="size-4 shrink-0" /> {project.demoUrl.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                    {project.repoUrl && (
                      <a href={project.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-ice hover:underline">
                        <Code2 className="size-4 shrink-0" /> {project.githubFullName ?? project.repoUrl.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                  </dd>
                </div>
              )}
              <div className="flex gap-6 border-t border-line pt-4 text-mist">
                <span className="inline-flex items-center gap-1.5" title="Visninger">
                  <Eye className="size-4" /> {compactNumber(project.viewCount)} visninger
                </span>
                <a href="#kommentarer" className="inline-flex items-center gap-1.5 hover:text-fg" title="Kommentarer">
                  <MessageCircle className="size-4" /> {commentTotal}
                </a>
              </div>
            </dl>
          </aside>
        </div>

        {more.length > 0 && (
          <section className="mt-24 border-t border-line pt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight">Mer fra {project.owner.name.split(" ")[0]}</h2>
              <Link href={`/@${project.owner.username}?fane=prosjekter`} className="text-sm text-mist hover:text-fg">
                Alle prosjekter <ArrowRight className="inline size-3.5" />
              </Link>
            </div>
            <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((p) => (
                <ProjectCard key={p.id} project={p} showOwner={false} />
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-bold tracking-tight">Lignende prosjekter</h2>
            <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
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
