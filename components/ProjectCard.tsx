import Link from "next/link";
import { Eye, Heart, MessageCircle, Pin } from "lucide-react";
import Avatar from "@/components/Avatar";
import ProjectCover from "@/components/ProjectCover";
import { compactNumber } from "@/components/ui/misc";
import { timeAgo } from "@/lib/format";
import type { ProjectCard as Card } from "@/lib/projects";

// Bildet er hovedsaken på kortet. Under står tittel, hvem som laget det og tall for
// reaksjoner og kommentarer. Prosjekter uten bilder får et generert cover.
export default function ProjectCard({
  project,
  showOwner = true,
  priority = false,
  size = "md",
}: {
  project: Card;
  showOwner?: boolean;
  priority?: boolean;
  size?: "md" | "lg";
}) {
  const href = `/prosjekt/${project.id}`;
  const when = project.publishedAt ?? project.createdAt;

  return (
    <article className="group relative">
      <Link
        href={href}
        aria-label={`Åpne prosjektet ${project.title}`}
        className="relative block overflow-hidden rounded-[20px] bg-surface ring-1 ring-line/60 transition duration-500 ease-out group-hover:ring-ice/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <div className={`relative overflow-hidden ${size === "lg" ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
          {project.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverImageUrl}
              alt=""
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="size-full object-cover transition duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.045]"
            />
          ) : (
            <div className="size-full transition duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.045]">
              <ProjectCover title={project.title} label={project.tags[0]?.name} />
            </div>
          )}

          {/* Mørk kant nederst, så tallene alltid er lesbare. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

          <div className="absolute left-3 top-3 flex gap-1.5">
            {project.status === "draft" && (
              <span className="rounded-md bg-warn px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#3a2104]">Utkast</span>
            )}
            {project.removed && (
              <span className="rounded-md bg-danger px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-white">Fjernet</span>
            )}
            {project.pinned && !showOwner && (
              <span className="inline-flex items-center gap-1 rounded-md bg-ink/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-fg backdrop-blur">
                <Pin className="size-3" aria-hidden="true" /> Festet
              </span>
            )}
          </div>

          {project.tags.length > 0 && project.coverImageUrl && (
            <div className="absolute bottom-3 left-3 flex translate-y-2 gap-1.5 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              {project.tags.slice(0, 2).map((t) => (
                <span key={t.slug} className="rounded-md bg-black/45 px-2 py-0.5 font-mono text-[10.5px] text-white backdrop-blur">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      <div className="mt-3.5 flex items-start gap-3">
        {showOwner && (
          <Link href={`/@${project.owner.username}`} aria-label={project.owner.name} className="mt-0.5 shrink-0">
            <Avatar name={project.owner.name} image={project.owner.image} size={30} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate font-semibold tracking-tight text-fg transition group-hover:text-ice">
            {project.title}
          </Link>
          <p className="mt-0.5 truncate text-[13px] text-mist">
            {showOwner ? (
              <Link href={`/@${project.owner.username}`} className="transition hover:text-fg">
                {project.owner.name}
              </Link>
            ) : (
              project.summary ?? project.tags.map((t) => t.name).slice(0, 3).join(" · ")
            )}
            {showOwner && (
              <time dateTime={new Date(when).toISOString()} suppressHydrationWarning className="text-mist/60">
                {" "}
                · {timeAgo(when)}
              </time>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 pt-0.5 text-xs text-mist" aria-label="Aktivitet">
          {project.reactionCount > 0 && (
            <span className="inline-flex items-center gap-1" title={`${project.reactionCount} reaksjoner`}>
              <Heart className="size-3.5" aria-hidden="true" />
              {compactNumber(project.reactionCount)}
            </span>
          )}
          {project.commentCount > 0 && (
            <span className="inline-flex items-center gap-1" title={`${project.commentCount} kommentarer`}>
              <MessageCircle className="size-3.5" aria-hidden="true" />
              {compactNumber(project.commentCount)}
            </span>
          )}
          {project.reactionCount === 0 && project.commentCount === 0 && project.viewCount > 0 && (
            <span className="inline-flex items-center gap-1" title={`${project.viewCount} visninger`}>
              <Eye className="size-3.5" aria-hidden="true" />
              {compactNumber(project.viewCount)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProjectGrid({
  projects,
  showOwner = true,
  columns = 3,
}: {
  projects: Card[];
  showOwner?: boolean;
  columns?: 2 | 3;
}) {
  return (
    <div className={`grid gap-x-6 gap-y-10 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : ""}`}>
      {projects.map((p, i) => (
        <ProjectCard key={p.id} project={p} showOwner={showOwner} priority={i < 3} />
      ))}
    </div>
  );
}
