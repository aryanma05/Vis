import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";
import { getT } from "@/lib/i18n/server";
import { getPopularTags, getProjectById, MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Rediger prosjekt"), robots: { index: false } };
}

// Skjermbildene av en nettside kan ta litt tid å lage.
export const maxDuration = 60;

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
  const [project, tags, t] = await Promise.all([getProjectById(id, user.id), getPopularTags(40), getT()]);
  if (!project?.isOwner) notFound();

  return (
    <main className="px-5 pb-28 pt-8 md:pb-16 md:pl-28 md:pr-10 md:pt-12">
      <div className="mx-auto max-w-5xl">
        <Link href={`/prosjekt/${project.id}`} className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Tilbake til prosjektet")}
        </Link>
        <h1 className="mt-4 display text-[34px] md:text-5xl">{t("Rediger prosjekt")}</h1>
        <div className="mt-6">
          <ProjectForm
            projectId={project.id}
            maxImages={MAX_PROJECT_IMAGES}
            images={project.images}
            tagSuggestions={tags.map((tag) => tag.name)}
            selfUsername={user.username}
            notice={
              failedImages > 0
                ? failedImages === 1
                  ? t("Prosjektet er lagret, men ett bilde kunne ikke lastes opp. Prøv å legge det til her.")
                  : t("Prosjektet er lagret, men {n} bilder kunne ikke lastes opp. Prøv å legge dem til her.", { n: failedImages })
                : undefined
            }
            initial={{
              title: project.title,
              summary: project.summary ?? "",
              description: project.description,
              tags: project.tags.map((tag) => tag.name),
              repoUrl: project.repoUrl ?? "",
              demoUrl: project.demoUrl ?? "",
              videoUrl: project.videoUrl ?? "",
              role: project.role ?? "",
              projectDate: project.projectDate ?? "",
              status: project.status,
              progress: project.progress,
              members: project.members.map(({ username, name, image }) => ({ username, name, image })),
            }}
          />
        </div>
      </div>
    </main>
  );
}
