import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";
import { getPopularTags, getProjectById, MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Rediger prosjekt", robots: { index: false } };

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bildefeil?: string }>;
}) {
  const [{ id }, { bildefeil }] = await Promise.all([params, searchParams]);
  const failedImages = Number(bildefeil) || 0;
  const user = await requireUser();
  const [project, tags] = await Promise.all([getProjectById(id, user.id), getPopularTags(40)]);
  if (!project?.isOwner) notFound();

  return (
    <main className="px-5 pb-28 pt-8 md:pb-16 md:pl-28 md:pr-10 md:pt-12">
      <div className="mx-auto max-w-5xl">
        <Link href={`/prosjekt/${project.id}`} className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> Tilbake til prosjektet
        </Link>
        <p className="mt-6 label-mono">Rediger prosjekt</p>
        <div className="mt-6">
          <ProjectForm
            projectId={project.id}
            maxImages={MAX_PROJECT_IMAGES}
            images={project.images}
            tagSuggestions={tags.map((t) => t.name)}
            notice={
              failedImages > 0
                ? `Prosjektet er lagret, men ${failedImages === 1 ? "ett bilde" : `${failedImages} bilder`} kunne ikke lastes opp. Prøv å legge ${failedImages === 1 ? "det" : "dem"} til her.`
                : undefined
            }
            initial={{
              title: project.title,
              summary: project.summary ?? "",
              description: project.description,
              tags: project.tags.map((t) => t.name),
              repoUrl: project.repoUrl ?? "",
              demoUrl: project.demoUrl ?? "",
              videoUrl: project.videoUrl ?? "",
              role: project.role ?? "",
              projectDate: project.projectDate ?? "",
              status: project.status,
            }}
          />
        </div>
      </div>
    </main>
  );
}
