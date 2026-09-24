"use client";

import { useState, useTransition } from "react";
import { loadMoreProjectsAction } from "@/app/actions/feed";
import ProjectCard from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import type { ProjectCard as Card } from "@/lib/projects";

// Prosjekter med «Vis flere». `source` avgjør hvilken liste som hentes videre.
export default function ProjectFeed({
  initial,
  cursor,
  source = "latest",
  columns = 3,
}: {
  initial: Card[];
  cursor: string | null;
  source?: "latest" | "following";
  columns?: 2 | 3;
}) {
  const [projects, setProjects] = useState(initial);
  const [next, setNext] = useState(cursor);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadMore = () =>
    startTransition(async () => {
      if (!next) return;
      const result = await loadMoreProjectsAction(next, source);
      if (!result.ok) return setError(result.error);
      setProjects((prev) => [...prev, ...result.data.projects.filter((p) => !prev.some((x) => x.id === p.id))]);
      setNext(result.data.nextCursor);
    });

  return (
    <>
      <div className={`grid gap-x-6 gap-y-10 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : ""}`}>
        {projects.map((p, i) => (
          <ProjectCard key={p.id} project={p} priority={i < 3} />
        ))}
      </div>
      {error && <p className="mt-8 text-center text-sm text-danger">{error}</p>}
      {next && (
        <div className="mt-14 flex justify-center">
          <Button variant="outline" onClick={loadMore} loading={pending}>
            {pending ? "Henter flere …" : "Vis flere prosjekter"}
          </Button>
        </div>
      )}
    </>
  );
}
