import { Archive, ArrowUpRight, CircleDot, Eye, GitCommitHorizontal, GitFork, Scale, Star, Tag as TagIcon } from "lucide-react";
import { GithubMark } from "@/components/icons";
import { CloneField, SyncReadmeButton } from "@/components/project/RepoActions";
import { compactNumber, Skeleton } from "@/components/ui/misc";
import { timeAgo } from "@/lib/format";
import { getRepoInsights } from "@/lib/github";

// Repoet bak prosjektet, hentet direkte fra GitHub: stjerner, språk, de siste
// endringene og hvem som har bidratt. Lastes for seg (Suspense), så siden ikke venter.
export default async function GithubRepoPanel({
  fullName,
  projectId,
  isOwner,
}: {
  fullName: string;
  projectId: string;
  isOwner: boolean;
}) {
  const repo = await getRepoInsights(fullName);
  const url = repo?.url ?? `https://github.com/${fullName}`;

  return (
    <section aria-label="Repoet på GitHub" className="overflow-hidden rounded-[22px] glass-card">
      <a href={url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 border-b border-line bg-surface/50 px-5 py-4 transition hover:bg-surface">
        <GithubMark className="size-5 shrink-0 text-fg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg group-hover:text-ice">{repo?.fullName ?? fullName}</span>
          <span className="block text-xs text-mist">
            {repo?.archived ? "Arkivert repo" : repo?.fork ? "Fork" : "Repo på GitHub"}
            {repo?.pushedAt && (
              <span suppressHydrationWarning> · oppdatert {timeAgo(repo.pushedAt)}</span>
            )}
          </span>
        </span>
        {repo?.archived ? <Archive className="size-4 text-mist" aria-hidden="true" /> : <ArrowUpRight className="size-4 text-mist transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ice" aria-hidden="true" />}
      </a>

      {repo ? (
        <div className="space-y-5 p-5 text-sm">
          <ul className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Stjerner", value: repo.stars, Icon: Star, href: `${url}/stargazers` },
              { label: "Forks", value: repo.forks, Icon: GitFork, href: `${url}/forks` },
              { label: "Saker", value: repo.openIssues, Icon: CircleDot, href: `${url}/issues` },
              { label: "Følger", value: repo.watchers, Icon: Eye, href: `${url}/watchers` },
            ].map(({ label, value, Icon, href }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noreferrer" title={`${value} ${label.toLowerCase()}`} className="block rounded-2xl bg-fill px-1 py-2.5 transition hover:bg-fill-2">
                  <span className="flex items-center justify-center gap-1 font-semibold tabular-nums text-fg">
                    <Icon className="size-3.5 text-mist" aria-hidden="true" />
                    {compactNumber(value)}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-mist">{label}</span>
                </a>
              </li>
            ))}
          </ul>

          {repo.languages.length > 0 && (
            <div>
              <p className="caption">Språk</p>
              <div className="mt-2.5 flex h-2 gap-px overflow-hidden rounded-full" role="img" aria-label={repo.languages.map((l) => `${l.name} ${Math.round(l.percent)} %`).join(", ")}>
                {repo.languages.map((l) => (
                  <span key={l.name} style={{ width: `${l.percent}%`, background: l.color }} className="h-full min-w-[3px]" />
                ))}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-mist">
                {repo.languages.map((l) => (
                  <li key={l.name} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden="true" />
                    <span className="text-fg/90">{l.name}</span>
                    {l.percent >= 0.1 ? `${l.percent.toFixed(l.percent < 10 ? 1 : 0).replace(".", ",")} %` : "<0,1 %"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(repo.license || repo.release) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {repo.release && (
                <a href={repo.release.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 text-fg/90 transition hover:bg-fill-2">
                  <TagIcon className="size-3.5" aria-hidden="true" /> {repo.release.tag}
                  {repo.release.publishedAt && (
                    <span className="text-mist" suppressHydrationWarning>
                      · {timeAgo(repo.release.publishedAt)}
                    </span>
                  )}
                </a>
              )}
              {repo.license && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-fg/90">
                  <Scale className="size-3.5" aria-hidden="true" /> {repo.license}
                </span>
              )}
            </div>
          )}

          {repo.commits.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="caption">Siste endringer</p>
                <a href={`${url}/commits/${encodeURIComponent(repo.defaultBranch)}`} target="_blank" rel="noreferrer" className="text-xs text-mist hover:text-ice">
                  Alle
                </a>
              </div>
              <ol className="mt-2 space-y-0.5">
                {repo.commits.map((c) => (
                  <li key={c.sha}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="group -mx-2 flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-surface/70">
                      {c.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${c.avatar}${c.avatar.includes("?") ? "&" : "?"}s=40`} alt="" className="mt-0.5 size-5 shrink-0 rounded-full" loading="lazy" />
                      ) : (
                        <GitCommitHorizontal className="mt-0.5 size-5 shrink-0 text-mist" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[13px] leading-5 text-fg/90 group-hover:text-fg">{c.message}</span>
                        <span className="block text-[11px] text-mist">
                          {c.author}
                          {c.date && <span suppressHydrationWarning> · {timeAgo(c.date)}</span>}
                          <span className="ml-1.5 font-mono text-mist/70">{c.sha}</span>
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {repo.contributors.length > 1 && (
            <div>
              <p className="caption">Bidragsytere</p>
              <ul className="mt-2.5 flex flex-wrap -space-x-1.5">
                {repo.contributors.map((c) => (
                  <li key={c.login}>
                    <a href={c.url} target="_blank" rel="noreferrer" title={`${c.login} · ${c.contributions} commits`} className="block rounded-full ring-2 ring-ink transition hover:z-10 hover:-translate-y-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${c.avatar}${c.avatar.includes("?") ? "&" : "?"}s=64`} alt={c.login} className="size-7 rounded-full" loading="lazy" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {repo.topics.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {repo.topics.map((t) => (
                <li key={t}>
                  <a href={`https://github.com/topics/${encodeURIComponent(t)}`} target="_blank" rel="noreferrer" className="block rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-medium text-fg/80 transition hover:bg-fill-2">
                    {t}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <CloneField cloneUrl={repo.cloneUrl} zipUrl={repo.zipUrl} />
        </div>
      ) : (
        <p className="p-5 text-sm leading-6 text-mist">GitHub svarer ikke akkurat nå, så tallene mangler. Lenken over virker fortsatt.</p>
      )}

      {isOwner && (
        <div className="border-t border-line px-5 py-3">
          <SyncReadmeButton projectId={projectId} />
        </div>
      )}
    </section>
  );
}

export function GithubRepoPanelSkeleton() {
  return (
    <div className="space-y-4 rounded-[22px] glass-card p-5" aria-hidden="true">
      <Skeleton className="h-6 w-2/3" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
