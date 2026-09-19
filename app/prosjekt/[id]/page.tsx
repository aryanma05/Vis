import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ImageSlider from "@/components/ImageSlider";
import Markdown from "@/components/Markdown";
import SiteHeader from "@/components/SiteHeader";
import { ui } from "@/components/ui";
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

  return (
    <main className="min-h-screen bg-[#071A52] text-white">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-6 py-12">
        <Link href={`/@${project.owner.username}`} className="text-sm text-[#B8D8E3] transition hover:text-white">
          ← Tilbake til {project.owner.name}
        </Link>

        {project.isOwner && <ProjectOwnerActions projectId={project.id} status={project.status} />}

        <p className="mt-10 text-sm font-medium uppercase tracking-widest text-[#C7F9FF]">Prosjekt</p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{project.title}</h1>

        {project.summary && <p className="mt-5 max-w-2xl text-lg leading-8 text-[#B8D8E3]">{project.summary}</p>}

        {project.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span key={tag.slug} className="rounded-full border border-[#174B76] bg-[#0A245E] px-3 py-1.5 text-sm text-[#C7F9FF]">
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {(project.repoUrl || project.demoUrl) && (
          <div className="mt-10 flex flex-wrap gap-3">
            {project.demoUrl && (
              <a href={project.demoUrl} target="_blank" rel="noreferrer" className={ui.primary}>
                Se demo
              </a>
            )}
            {project.repoUrl && (
              <a href={project.repoUrl} target="_blank" rel="noreferrer" className={ui.secondary}>
                Se på GitHub
              </a>
            )}
          </div>
        )}

        {project.images.length > 0 && (
          <div className="mt-10">
            <ImageSlider images={project.images} title={project.title} />
          </div>
        )}

        {project.description.trim() && (
          <article className="mt-12 rounded-2xl border border-[#174B76] bg-[#0A245E]/50 p-6 md:p-8">
            <Markdown>{project.description}</Markdown>
          </article>
        )}

        <div className="mt-14 rounded-2xl border border-[#174B76] bg-[#0A245E] p-6">
          <p className="text-sm font-medium text-[#C7F9FF]">Laget av</p>
          <Link href={`/@${project.owner.username}`} className="mt-2 inline-block text-xl font-semibold transition hover:text-[#C7F9FF]">
            {project.owner.name}
          </Link>
          <p className="mt-1 text-sm text-[#B8D8E3]">@{project.owner.username}</p>
        </div>
      </section>
    </main>
  );
}
