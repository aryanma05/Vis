import ProjectCard from "@/components/ProjectCard";
import type { ProjectCard as Card } from "@/lib/projects";

// Høyden på hvert kort, i rader à 7–8 px. Mønsteret går igjen, så kortene aldri står
// helt på linje, men ingen blir så lave at bildet blir lite (minst ~220 px bilde).
const SPANS = [56, 40, 64, 46, 52, 38, 60, 44, 50];
const FEATURED_SPAN = 64;

// Prosjekter i ulike størrelser som legger seg der det er plass, som en murvegg.
// Rutenettet plasserer hvert kort i den kolonnen som blir ledig først, så rekkefølgen
// (nyeste først osv.) holdes fra venstre mot høyre og ovenfra og ned. Det første kortet
// blir bredt når det er nok prosjekter til å fylle rundt det.
export default function ProjectMasonry({
  projects,
  showOwner = true,
  columns = 3,
  feature = true,
}: {
  projects: Card[];
  showOwner?: boolean;
  columns?: 2 | 3;
  feature?: boolean;
}) {
  const featureFirst = feature && projects.length >= (columns === 3 ? 4 : 3);

  return (
    <div
      className={`grid grid-cols-1 gap-x-6 [grid-auto-rows:7px] sm:grid-cols-2 sm:[grid-auto-rows:8px] ${
        columns === 3 ? "xl:grid-cols-3" : ""
      }`}
    >
      {projects.map((project, i) => {
        const wide = featureFirst && i === 0;
        const span = wide ? FEATURED_SPAN : SPANS[(i - (featureFirst ? 1 : 0)) % SPANS.length];
        return (
          <div
            key={project.id}
            style={{ "--span": span } as React.CSSProperties}
            className={`row-span-(--span) pb-10 ${wide ? "sm:col-span-2" : ""}`}
          >
            <ProjectCard project={project} showOwner={showOwner} priority={i < 4} size={wide ? "lg" : "md"} fill />
          </div>
        );
      })}
    </div>
  );
}
