import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import Comments from "@/components/comments/Comments";
import Markdown from "@/components/Markdown";
import ProjectGallery from "@/components/ProjectGallery";
import ProjectCover from "@/components/ProjectCover";
import ReadMore from "@/components/ReadMore";
import { TechTag } from "@/components/TechTag";
import { ExternalIcon, GithubIcon } from "@/components/icons";
import { formatYearMonth } from "@/lib/format";
import { getProjectById } from "@/lib/projects";
import { getCurrentUser } from "@/lib/session";
import ProjectOwnerActions from "./ProjectOwnerActions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return { title: "Fant ikke prosjektet – vis" };
  return {
    title: `${project.title} av ${project.owner.name} – vis`,
    description: project.summary ?? undefined,
    openGraph: project.coverImageUrl ? { images: [project.coverImageUrl] } : undefined,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const project = await getProjectById(id, viewer?.id);

  if (!project) notFound();

  const date = formatYearMonth(project.projectDate);
  const hasImages = project.images.length > 0;

  return (
    <main className="min-h-screen pb-28 md:pb-16 md:pl-28 md:pr-10">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-6">
        {project.isOwner && <ProjectOwnerActions projectId={project.id} status={project.status} />}

        {/* Kort topptekst: tittel, hvem og lenker. Bildene tar resten av plassen. */}
        <header className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold leading-[1.05] tracking-tight md:text-5xl">{project.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-mist">
              <Link href={`/@${project.owner.username}`} className="inline-flex items-center gap-2 transition hover:text-fg">
                <Avatar name={project.owner.name} image={project.owner.image} size={24} />
                {project.owner.name}
              </Link>
              {date && (
                <>
                  <span className="text-mist/40">·</span>
                  <span>{date}</span>
                </>
              )}
            </p>
          </div>

          {(project.demoUrl || project.repoUrl) && (
            <div className="flex flex-wrap gap-2">
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                >
                  Åpne <ExternalIcon />
                </a>
              )}
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-fg transition hover:border-primary"
                >
                  <GithubIcon /> Kode
                </a>
              )}
            </div>
          )}
        </header>

        <div className="mt-8">
          {hasImages ? (
            <ProjectGallery images={project.images} title={project.title} />
          ) : (
            <div className="aspect-[16/9] overflow-hidden rounded-3xl border border-line">
              <ProjectCover title={project.title} label={project.tags[0]?.name} showTitle={false}>
                {project.isOwner && (
                  <Link
                    href={`/prosjekt/${project.id}/rediger`}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center transition hover:bg-primary/5"
                  >
                    <span className="text-2xl font-semibold text-fg">Legg til bilder</span>
                    <span className="mt-2 text-sm text-mist">Prosjekter med bilder får langt mer oppmerksomhet.</span>
                  </Link>
                )}
              </ProjectCover>
            </div>
          )}
        </div>

        {/* Teksten kommer etter bildene, kort og samlet. */}
        <section className="mx-auto mt-14 max-w-3xl space-y-8">
          {project.summary && <p className="text-xl leading-8 text-fg md:text-2xl md:leading-9">{project.summary}</p>}

          {project.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Laget med">
              {project.tags.map((t) => (
                <li key={t.slug}>
                  <Link href={`/sok?tag=${encodeURIComponent(t.slug)}`} aria-label={`Se flere prosjekter med ${t.name}`}>
                    <TechTag label={t.name} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {project.description.trim() ? (
            <ReadMore label="Les mer om prosjektet">
              <Markdown>{project.description}</Markdown>
            </ReadMore>
          ) : (
            project.isOwner &&
            !project.summary && (
              <p className="text-sm text-mist">
                <Link href={`/prosjekt/${project.id}/rediger`} className="text-fg underline underline-offset-4">
                  Skriv en setning om prosjektet
                </Link>{" "}
                (valgfritt).
              </p>
            )
          )}
        </section>

        <section className="mx-auto mt-20 max-w-3xl">
          <Comments projectId={project.id} ownerId={project.owner.id} viewer={viewer} />
        </section>
      </div>
    </main>
  );
}
