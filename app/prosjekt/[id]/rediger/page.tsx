import { notFound } from "next/navigation";
import ProjectForm from "@/components/ProjectForm";
import { getProjectById, MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Rediger prosjekt – vis" };

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
  const project = await getProjectById(id, user.id);
  if (!project?.isOwner) notFound();

  return (
    <main className="min-h-screen pb-28 md:pb-16 md:pl-28 md:pr-10">
      <section className="mx-auto max-w-5xl px-6 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Rediger prosjekt</p>
        <div className="mt-6">
          <ProjectForm
            projectId={project.id}
            maxImages={MAX_PROJECT_IMAGES}
            images={project.images}
            notice={
              failedImages > 0
                ? `Prosjektet er lagret, men ${failedImages === 1 ? "ett bilde" : `${failedImages} bilder`} kunne ikke lastes opp. Prøv å legge ${failedImages === 1 ? "det" : "dem"} til her.`
                : undefined
            }
            initial={{
              title: project.title,
              summary: project.summary ?? "",
              description: project.description,
              tags: project.tags.map((t) => t.name).join(", "),
              repoUrl: project.repoUrl ?? "",
              demoUrl: project.demoUrl ?? "",
              projectDate: project.projectDate ?? "",
              status: project.status,
            }}
          />
        </div>
      </section>
    </main>
  );
}
