import Link from "next/link";
import Avatar from "@/components/Avatar";
import ProjectCover from "@/components/ProjectCover";
import { CommentIcon } from "@/components/icons";
import type { ProjectCard as Card } from "@/lib/projects";

// Bildet er hovedsaken på kortet: stort, uten ramme, og bare tittel og navn under.
// Prosjekter uten bilder får et generert cover.
export default function ProjectCard({ project, showOwner = true }: { project: Card; showOwner?: boolean }) {
  const href = `/prosjekt/${project.id}`;

  return (
    <article className="group">
      <Link
        href={href}
        aria-label={`Åpne prosjektet ${project.title}`}
        className="block overflow-hidden rounded-2xl bg-surface transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          {project.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="size-full transition duration-700 ease-out group-hover:scale-[1.04]">
              <ProjectCover title={project.title} label={project.tags[0]?.name} />
            </div>
          )}
          {project.status === "draft" && (
            <span className="absolute left-3 top-3 rounded-md bg-amber-300 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-950">
              Utkast
            </span>
          )}
          {project.commentCount > 0 && (
            <span
              className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-xs text-fg opacity-0 backdrop-blur transition group-hover:opacity-100"
              title={`${project.commentCount} kommentarer`}
            >
              <CommentIcon className="h-3.5 w-3.5" />
              {project.commentCount}
            </span>
          )}
        </div>
      </Link>

      <div className="mt-3 flex items-center gap-2.5">
        {showOwner && (
          <Link href={`/@${project.owner.username}`} aria-label={project.owner.name} className="shrink-0">
            <Avatar name={project.owner.name} image={project.owner.image} size={24} />
          </Link>
        )}
        <Link href={href} className="min-w-0 truncate font-medium text-fg transition group-hover:text-ice">
          {project.title}
        </Link>
        {showOwner && (
          <Link
            href={`/@${project.owner.username}`}
            className="ml-auto shrink-0 truncate text-sm text-mist transition hover:text-fg"
          >
            {project.owner.name}
          </Link>
        )}
      </div>
    </article>
  );
}

export function ProjectGrid({ projects, showOwner = true }: { projects: Card[]; showOwner?: boolean }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} showOwner={showOwner} />
      ))}
    </div>
  );
}
