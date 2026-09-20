"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { importGithubRepoAction, listGithubReposAction } from "@/app/actions/github";
import { ui } from "@/components/ui";
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
    return (repos ?? []).filter(
      (r) => !q || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
    );
  }, [repos, query]);

  async function importRepo(fullName: string) {
    setImporting(fullName);
    setError(null);
    const result = await importGithubRepoAction(fullName);
    if (!result.ok) {
      setError(result.error);
      setImporting(null);
      return;
    }
    router.push(`/prosjekt/${result.data.projectId}`);
  }

  if (error && !repos) return <p className={ui.error}>{error}</p>;
  if (!repos) return <p className="text-mist">Henter repoene dine fra GitHub…</p>;
  if (repos.length === 0) return <p className="text-mist">Fant ingen offentlige repoer på GitHub-kontoen din.</p>;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søk i repoene dine"
        className={ui.input}
      />
      {error && <p className={`${ui.error} mt-3`}>{error}</p>}

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {filtered.map((repo) => (
          <li key={repo.id} className="flex items-center justify-between gap-4 bg-ink px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {repo.fullName}
                {repo.fork && <span className="ml-2 text-xs text-mist">fork</span>}
                {repo.archived && <span className="ml-2 text-xs text-mist">arkivert</span>}
              </p>
              <p className="truncate text-sm text-mist">
                {[repo.language, repo.stars > 0 ? `★ ${repo.stars}` : null, repo.description].filter(Boolean).join(" · ")}
              </p>
            </div>
            {repo.alreadyImported ? (
              <span className="shrink-0 text-sm text-mist">Importert</span>
            ) : (
              <button
                type="button"
                onClick={() => importRepo(repo.fullName)}
                disabled={importing !== null}
                className={`${ui.primary} shrink-0 px-4 py-2 text-sm`}
              >
                {importing === repo.fullName ? "Importerer…" : "Importer"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className={`${ui.hint} mt-3`}>
        Prosjektet lagres som utkast med beskrivelse, teknologier og bilder fra README-en. Du kan se over og publisere det etterpå.
      </p>
    </div>
  );
}
