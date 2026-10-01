"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowUpRight, GitFork, Search, Star } from "lucide-react";
import { importGithubRepoAction, listGithubReposAction, lookupGithubAction } from "@/app/actions/github";
import { OAuthButton } from "@/components/GithubButton";
import { GithubMark } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/format";
import type { RepoSummary } from "@/lib/github";

type Source = { kind: "mine" } | { kind: "user"; login: string; avatar: string | null } | { kind: "repo" };

// Import fra GitHub. Uten tilkobling skriver man et brukernavn eller limer inn en
// repo-lenke, og vi henter de offentlige repoene. Med tilkobling vises dine egne repoer
// (også fra organisasjoner) først.
export default function GithubImporter({
  linked,
  canLink,
  suggestedLogin,
}: {
  linked: boolean;
  canLink: boolean;
  suggestedLogin: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(linked ? "" : (suggestedLogin ?? ""));
  const [source, setSource] = useState<Source | null>(null);
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [loading, setLoading] = useState(linked || Boolean(suggestedLogin));
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  type Mine = Awaited<ReturnType<typeof listGithubReposAction>>;
  type Lookup = Awaited<ReturnType<typeof lookupGithubAction>>;

  function showMine(result: Mine) {
    setLoading(false);
    if (!result.ok) return setError(result.error);
    setSource({ kind: "mine" });
    setRepos(result.data);
    setFilter("");
  }

  function showLookup(result: Lookup) {
    setLoading(false);
    if (!result.ok) return setError(result.error);
    setSource(result.data.kind === "user" ? { kind: "user", login: result.data.login, avatar: result.data.avatar } : { kind: "repo" });
    setRepos(result.data.repos);
    setFilter("");
  }

  async function loadMine() {
    setLoading(true);
    setError(null);
    showMine(await listGithubReposAction());
  }

  async function lookup(value = query) {
    const text = value.trim();
    if (!text) return inputRef.current?.focus();
    setLoading(true);
    setError(null);
    showLookup(await lookupGithubAction(text));
  }

  // Første visning: dine repoer hvis GitHub er koblet til, ellers brukernavnet fra profilen.
  useEffect(() => {
    if (linked) listGithubReposAction().then(showMine);
    else if (suggestedLogin) lookupGithubAction(suggestedLogin).then(showLookup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
  }, [repos, filter]);

  async function importRepo(fullName: string) {
    setImporting(fullName);
    const result = await importGithubRepoAction(fullName);
    if (!result.ok) {
      toast.error(result.error);
      setImporting(null);
      return;
    }
    const { alreadyImported, screenshots } = result.data;
    toast.success(alreadyImported ? "Repoet er allerede importert" : "Importert som utkast", {
      description: screenshots > 0 ? `Vi tok ${screenshots} skjermbilder av nettsiden. Se over og publiser når du er klar.` : "Se over og publiser når du er klar.",
    });
    router.push(`/prosjekt/${result.data.projectId}`);
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          lookup();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="relative flex-1">
          <span className="sr-only">GitHub-brukernavn eller lenke til et repo</span>
          <GithubMark className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-mist" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Brukernavn, eller github.com/navn/repo"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputClass} pl-11`}
          />
        </label>
        <Button type="submit" loading={loading && source?.kind !== "mine"} className="sm:w-auto">
          Hent repoer
        </Button>
      </form>

      {!linked && canLink && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-fill px-4 py-3 text-sm text-mist">
          <span>Koble til GitHub for å se repoer fra organisasjoner også, og slippe å skrive brukernavnet.</span>
          <div className="w-full sm:w-auto">
            <OAuthButton provider="github" mode="link" callbackURL="/ny?fra=github" label="Koble til GitHub" />
          </div>
        </div>
      )}

      {error && <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading && !repos && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!repos && !loading && !error && (
        <p className="text-sm leading-6 text-mist">
          Skriv GitHub-brukernavnet ditt for å se de offentlige repoene dine, eller lim inn lenken til ett repo. Vi henter
          README, teknologier og skjermbilder, så lager du resten av prosjektsiden her.
        </p>
      )}

      {repos && source && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 text-sm text-mist">
              {source.kind === "user" && source.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source.avatar} alt="" className="size-7 rounded-full ring-1 ring-line" />
              )}
              {source.kind === "mine" && "Dine repoer på GitHub"}
              {source.kind === "user" && (
                <span>
                  <span className="font-semibold text-fg">@{source.login}</span> · {repos.length} offentlige repoer
                </span>
              )}
              {source.kind === "repo" && "Repoet du limte inn"}
            </p>
            {linked && source.kind !== "mine" && (
              <button type="button" onClick={loadMine} className="text-sm font-medium text-ice hover:underline">
                Tilbake til dine repoer
              </button>
            )}
          </div>

          {repos.length > 6 && (
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
              <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer repoene" className={`${inputClass} pl-11`} />
            </div>
          )}

          {repos.length === 0 ? (
            <p className="text-mist">Fant ingen offentlige repoer her.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
              {filtered.map((repo) => (
                <li key={repo.id} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface/50">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      <span className="truncate">{source.kind === "user" ? repo.name : repo.fullName}</span>
                      {repo.fork && <GitFork className="size-3.5 shrink-0 text-mist" aria-label="Fork" />}
                      {repo.archived && <Archive className="size-3.5 shrink-0 text-mist" aria-label="Arkivert" />}
                      <a href={repo.url} target="_blank" rel="noreferrer" aria-label={`Åpne ${repo.fullName} på GitHub`} className="shrink-0 text-mist hover:text-fg">
                        <ArrowUpRight className="size-3.5" />
                      </a>
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
              {filtered.length === 0 && <li className="px-5 py-4 text-sm text-mist">Ingen repoer passet «{filter}».</li>}
            </ul>
          )}
          <p className="mt-3 text-[13px] leading-5 text-mist/80">
            Prosjektet lagres som utkast med README, teknologier og bilder fra repoet. Du kan se over og publisere det etterpå.
            Del bare prosjekter du selv har laget eller vært med på.
          </p>
        </div>
      )}
    </div>
  );
}
