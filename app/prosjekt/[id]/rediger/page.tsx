import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ProjectForm from "@/components/ProjectForm";
import { getProjectById, MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Rediger prosjekt – vis" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const project = await getProjectById(id, user.id);
  if (!project?.isOwner) notFound();

  return (
    <main className="min-h-screen bg-[#071A52] text-white">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Rediger prosjekt</h1>
        <div className="mt-8">
          <ProjectForm
            projectId={project.id}
            maxImages={MAX_PROJECT_IMAGES}
            images={project.images}
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
