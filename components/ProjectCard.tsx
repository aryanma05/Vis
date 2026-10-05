"use client";

import Link from "next/link";
import { Eye, Heart, MessageCircle, Pin } from "lucide-react";
import Avatar from "@/components/Avatar";
import ProjectCover from "@/components/ProjectCover";
import { compactNumber } from "@/components/ui/misc";
import { useLocale } from "@/components/LocaleProvider";
import { makeT } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import type { ProjectCard as Card } from "@/lib/projects";

// Bildet er hovedsaken på kortet. Under står tittel, hvem som laget det og tall for
// reaksjoner og kommentarer. Prosjekter uten bilder får et enkelt fargecover.
// `fill`: bildet fyller høyden kortet får av rutenettet (ProjectMasonry) i stedet for et fast format.
export default function ProjectCard({
  project,
  showOwner = true,
  priority = false,
  size = "md",
  fill = false,
}: {
  project: Card;
  showOwner?: boolean;
  priority?: boolean;
  size?: "md" | "lg";
  fill?: boolean;
}) {
  const locale = useLocale();
  const t = makeT(locale);
  const href = `/prosjekt/${project.id}`;
  const when = project.publishedAt ?? project.createdAt;

  return (
    <article className={`group relative ${fill ? "flex h-full flex-col" : ""}`}>
      <Link
        href={href}
        aria-label={t("Åpne prosjektet {title}", { title: project.title })}
        className={`glass-card relative block overflow-hidden rounded-[22px] transition duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea ${
          fill ? "min-h-0 flex-1" : ""
        }`}
      >
        <div className={`relative overflow-hidden ${fill ? "h-full" : size === "lg" ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
          {project.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverImageUrl}
              alt=""
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="size-full object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.025]"
            />
          ) : (
            <div className="size-full transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.025]">
              <ProjectCover title={project.title} label={project.tags[0]?.name} />
            </div>
          )}

          <div className="absolute left-3 top-3 flex gap-1.5">
            {project.status === "draft" && (
              <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                <span className="size-1.5 rounded-full bg-[#ffd60a]" aria-hidden="true" /> {t("Utkast")}
              </span>
            )}
            {project.progress === "in_progress" && (
              <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                <span className="size-1.5 rounded-full bg-[#ff9f0a]" aria-hidden="true" /> {t("Under arbeid")}
              </span>
            )}
            {project.removed && (
              <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                <span className="size-1.5 rounded-full bg-[#ff453a]" aria-hidden="true" /> {t("Fjernet")}
              </span>
            )}
            {project.pinned && !showOwner && (
              <span className="glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                <Pin className="size-3" aria-hidden="true" /> {t("Festet")}
              </span>
            )}
          </div>

          {project.tags.length > 0 && project.coverImageUrl && (
            <div className="absolute bottom-3 left-3 flex translate-y-1 gap-1.5 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              {project.tags.slice(0, 2).map((t) => (
                <span key={t.slug} className="glass-dark rounded-full px-2.5 py-1 text-[11px] font-medium">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="glass-rim" aria-hidden="true" />
      </Link>

      <div className="mt-3.5 flex items-start gap-3">
        {showOwner && (
          <Link href={`/@${project.owner.username}`} aria-label={project.owner.name} className="mt-0.5 shrink-0">
            <Avatar name={project.owner.name} image={project.owner.image} size={30} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-[15px] font-semibold text-fg">
            {project.title}
          </Link>
          <p className="mt-0.5 truncate text-[13px] text-mist">
            {showOwner ? (
              <>
                <Link href={`/@${project.owner.username}`} className="transition hover:text-fg">
                  {project.owner.name}
                </Link>
                {project.members.length > 0 &&
                  ` ${t(project.members.length === 1 ? "og {name}" : "og {n} andre", { name: project.members[0].name, n: project.members.length })}`}
              </>
            ) : (
              project.summary ?? project.tags.map((t) => t.name).slice(0, 3).join(" · ")
            )}
            {showOwner && (
              <time dateTime={new Date(when).toISOString()} suppressHydrationWarning>
                {" "}
                · {timeAgo(when, locale)}
              </time>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 pt-0.5 text-xs text-mist" aria-label={t("Aktivitet")}>
          {project.reactionCount > 0 && (
            <span className="inline-flex items-center gap-1" title={t("{n} reaksjoner", { n: project.reactionCount })}>
              <Heart className="size-3.5" aria-hidden="true" />
              {compactNumber(project.reactionCount)}
            </span>
          )}
          {project.commentCount > 0 && (
            <span className="inline-flex items-center gap-1" title={t("{n} kommentarer", { n: project.commentCount })}>
              <MessageCircle className="size-3.5" aria-hidden="true" />
              {compactNumber(project.commentCount)}
            </span>
          )}
          {project.reactionCount === 0 && project.commentCount === 0 && project.viewCount > 0 && (
            <span className="inline-flex items-center gap-1" title={t("{n} visninger", { n: project.viewCount })}>
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
    <div className={`grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : ""}`}>
      {projects.map((p, i) => (
        <ProjectCard key={p.id} project={p} showOwner={showOwner} priority={i < 3} />
      ))}
    </div>
  );
}
