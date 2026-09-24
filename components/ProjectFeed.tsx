"use client";

import { useState, useTransition } from "react";
import { loadMoreProjectsAction } from "@/app/actions/feed";
import ProjectCard from "@/components/ProjectCard";
import type { ProjectCard as Card } from "@/lib/projects";

export default function ProjectFeed({ initial, cursor }: { initial: Card[]; cursor: string | null }) {
  const [projects, setProjects] = useState(initial);
  const [next, setNext] = useState(cursor);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadMore = () =>
    startTransition(async () => {
      if (!next) return;
      const result = await loadMoreProjectsAction(next);
      if (!result.ok) return setError(result.error);
      setProjects((prev) => [...prev, ...result.data.projects.filter((p) => !prev.some((x) => x.id === p.id))]);
      setNext(result.data.nextCursor);
    });

  return (
    <>
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
      {error && <p className="mt-8 text-center text-sm text-red-300">{error}</p>}
      {next && (
        <div className="mt-14 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="rounded-lg border border-line px-6 py-3 text-sm font-medium text-fg transition hover:border-primary hover:text-ice disabled:opacity-60"
          >
            {pending ? "Henter flere…" : "Vis flere prosjekter"}
          </button>
        </div>
      )}
    </>
  );
}
