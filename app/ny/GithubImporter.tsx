"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Archive, GitFork, Search, Star } from "lucide-react";
import { importGithubRepoAction, listGithubReposAction } from "@/app/actions/github";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/format";
import type { RepoSummary } from "@/lib/github";

export default function GithubImporter() {
  const router = useRouter();
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    listGithubReposAction().then((result) => (result.ok ? setRepos(result.data) : setError(result.error)));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
  }, [repos, query]);

  async function importRepo(fullName: string) {
    setImporting(fullName);
    const result = await importGithubRepoAction(fullName);
    if (!result.ok) {
      toast.error(result.error);
      setImporting(null);
      return;
    }
    toast.success(result.data.alreadyImported ? "Repoet er allerede importert" : "Importert som utkast", { description: "Se over og publiser når du er klar." });
    router.push(`/prosjekt/${result.data.projectId}`);
  }

  if (error && !repos) return <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (!repos) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (repos.length === 0) return <p className="text-mist">Fant ingen offentlige repoer på GitHub-kontoen din.</p>;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk i repoene dine" className={`${inputClass} pl-11`} />
      </div>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line">
        {filtered.map((repo) => (
          <li key={repo.id} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface/50">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-medium">
                {repo.fullName}
                {repo.fork && <GitFork className="size-3.5 text-mist" aria-label="Fork" />}
                {repo.archived && <Archive className="size-3.5 text-mist" aria-label="Arkivert" />}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 truncate text-sm text-mist">
                {repo.language && <span>{repo.language}</span>}
                {repo.stars > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5" /> {repo.stars}
                  </span>
                )}
                {repo.pushedAt && <span suppressHydrationWarning>oppdatert {timeAgo(repo.pushedAt)}</span>}
                {repo.description && <span className="truncate">{repo.description}</span>}
              </p>
            </div>
            {repo.alreadyImported ? (
              <span className="shrink-0 text-sm text-success">Importert</span>
            ) : (
              <Button size="sm" onClick={() => importRepo(repo.fullName)} disabled={importing !== null} loading={importing === repo.fullName}>
                Importer
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-mist/80">
        Prosjektet lagres som utkast med beskrivelse, teknologier og bilder fra README-en. Du kan se over og publisere det etterpå.
      </p>
    </div>
  );
}
