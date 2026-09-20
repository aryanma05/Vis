import ProjectView from "@/components/ProjectView";
import { getMockProject } from "@/lib/mockData";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getMockProject(id);

  return <ProjectView project={project} />;
}