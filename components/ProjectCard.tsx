import Link from "next/link";
import Avatar from "@/components/Avatar";
import ProjectCover from "@/components/ProjectCover";
import { CommentIcon } from "@/components/icons";
import type { ProjectCard as Card } from "@/lib/projects";

export default function ProjectCard({ project, showOwner = true }: { project: Card; showOwner?: boolean }) {
  const href = `/prosjekt/${project.id}`;
  const tech = project.tags.slice(0, 3).map((t) => t.name);

  return (
    <article className="group">
      <Link href={href} className="block overflow-hidden rounded-xl border border-line bg-surface">
        <div className="relative aspect-[4/3] overflow-hidden">
          {project.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverImageUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
            />
          ) : (
            <div className="size-full transition duration-700 ease-out group-hover:scale-[1.035]">
              <ProjectCover title={project.title} label={project.tags[0]?.name} />
            </div>
          )}
          {project.status === "draft" && (
            <span className="absolute left-3 top-3 rounded-md bg-amber-300 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-950">
              Utkast
            </span>
          )}
        </div>
      </Link>

      <div className="mt-3 flex items-start gap-3">
        {showOwner && (
          <Link href={`/@${project.owner.username}`} className="mt-0.5" aria-label={project.owner.name}>
            <Avatar name={project.owner.name} image={project.owner.image} size={28} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate font-medium text-white transition group-hover:text-ice">
            {project.title}
          </Link>
          <p className="mt-0.5 truncate text-sm text-mist/80">
            {showOwner && (
              <>
                <Link href={`/@${project.owner.username}`} className="transition hover:text-white">
                  {project.owner.name}
                </Link>
                {tech.length > 0 && <span className="mx-1.5 text-mist/40">/</span>}
              </>
            )}
            <span className="font-mono text-xs">{tech.join(" · ")}</span>
          </p>
        </div>
        {project.commentCount > 0 && (
          <span className="mt-1 flex shrink-0 items-center gap-1 text-xs text-mist/70" title={`${project.commentCount} kommentarer`}>
            <CommentIcon className="h-3.5 w-3.5" />
            {project.commentCount}
          </span>
        )}
      </div>
    </article>
  );
}

export function ProjectGrid({ projects, showOwner = true }: { projects: Card[]; showOwner?: boolean }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} showOwner={showOwner} />
      ))}
    </div>
  );
}
