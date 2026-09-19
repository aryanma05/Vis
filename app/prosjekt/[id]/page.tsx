import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import Comments from "@/components/comments/Comments";
import ImageSlider from "@/components/ImageSlider";
import Markdown from "@/components/Markdown";
import ProjectCover from "@/components/ProjectCover";
import SiteHeader from "@/components/SiteHeader";
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

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-4">
      <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-mist/60">{label}</dt>
      <dd className="mt-1.5 text-sm text-white">{children}</dd>
    </div>
  );
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const project = await getProjectById(id, viewer?.id);

  if (!project) notFound();

  const date = formatYearMonth(project.projectDate);

  return (
    <main className="min-h-screen bg-ink text-white">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        {project.isOwner && <ProjectOwnerActions projectId={project.id} status={project.status} />}

        <header className="mt-8 max-w-4xl">
          <Link
            href={`/@${project.owner.username}`}
            className="inline-flex items-center gap-2.5 text-sm text-mist transition hover:text-white"
          >
            <Avatar name={project.owner.name} image={project.owner.image} size={26} />
            {project.owner.name}
            <span className="text-mist/50">@{project.owner.username}</span>
          </Link>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight md:text-7xl">{project.title}</h1>
          {project.summary && <p className="mt-6 max-w-2xl text-lg leading-8 text-mist md:text-xl">{project.summary}</p>}

          {(project.demoUrl || project.repoUrl) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-ice px-5 py-3 font-semibold text-ink transition hover:bg-white"
                >
                  Åpne demo <ExternalIcon />
                </a>
              )}
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-3 font-semibold text-white transition hover:border-ice"
                >
                  <GithubIcon /> Se koden
                </a>
              )}
            </div>
          )}
        </header>

        <div className="mt-12">
          {project.images.length > 0 ? (
            <ImageSlider images={project.images} title={project.title} />
          ) : (
            <div className="aspect-[16/6] overflow-hidden rounded-2xl border border-line">
              <ProjectCover title={project.title} label={project.tags[0]?.name} showTitle={false}>
                {project.isOwner && (
                  <Link
                    href={`/prosjekt/${project.id}/rediger`}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center transition hover:bg-ice/5"
                  >
                    <span className="text-lg font-medium text-white">Legg til skjermbilder</span>
                    <span className="mt-1 text-sm text-mist">Prosjekter med bilder får langt mer oppmerksomhet.</span>
                  </Link>
                )}
              </ProjectCover>
            </div>
          )}
        </div>

        <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-16">
            {project.description.trim() ? (
              <article>
                <Markdown>{project.description}</Markdown>
              </article>
            ) : (
              project.isOwner && (
                <p className="rounded-xl border border-dashed border-line p-6 text-mist">
                  Ingen beskrivelse ennå.{" "}
                  <Link href={`/prosjekt/${project.id}/rediger`} className="text-white underline underline-offset-4">
                    Fortell hva prosjektet handler om
                  </Link>
                  .
                </p>
              )
            )}

            <Comments projectId={project.id} ownerId={project.owner.id} viewer={viewer} />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <dl>
              {project.tags.length > 0 && (
                <Meta label="Laget med">
                  <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {project.tags.map((t) => (
                      <li key={t.slug}>
                        <Link href={`/sok?tag=${encodeURIComponent(t.slug)}`} className="text-mist transition hover:text-ice">
                          {t.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Meta>
              )}
              {date && <Meta label="Laget">{date}</Meta>}
              {project.githubFullName && (
                <Meta label="Repo">
                  <a href={project.repoUrl ?? "#"} target="_blank" rel="noreferrer" className="font-mono text-mist hover:text-ice">
                    {project.githubFullName}
                  </a>
                </Meta>
              )}
              <Meta label="Laget av">
                <Link href={`/@${project.owner.username}`} className="flex items-center gap-3 transition hover:text-ice">
                  <Avatar name={project.owner.name} image={project.owner.image} size={36} />
                  <span>
                    <span className="block font-medium">{project.owner.name}</span>
                    <span className="block text-mist/70">Se profil og CV</span>
                  </span>
                </Link>
              </Meta>
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}
