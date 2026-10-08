import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flag, FolderX, MessageSquareWarning, Search, ShieldCheck, UserX } from "lucide-react";
import Avatar from "@/components/Avatar";
import { BanButton, DeleteCommentButton, GrantPlanButton, RemoveProjectButton, ResolveButtons, VerifyCompanyButton } from "@/components/moderation/AdminActions";
import { inputClass } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { getAdmin, getModerationCounts, listCompaniesForAdmin, listUsers } from "@/lib/admin";
import { getBillingSummary } from "@/lib/billing";
import { REPORT_REASON_LABELS } from "@/lib/constants";
import { checkEnv } from "@/lib/env";
import { getErrorSummary } from "@/lib/errors";
import { getGithubStatus } from "@/lib/github";
import { getKeyMetrics } from "@/lib/metrics";
import { timeAgo } from "@/lib/format";
import { getProjectById } from "@/lib/projects";
import { listReports } from "@/lib/reports";
import MetricsTab from "./MetricsTab";
import SystemTab from "./SystemTab";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const TABS = ["rapporter", "brukere", "bedrifter", "nokkeltall", "system"] as const;
type Tab = (typeof TABS)[number];

type Props = { searchParams: Promise<{ fane?: string; status?: string; q?: string; prosjekt?: string }> };

const TYPE_ICON = { project: FolderX, comment: MessageSquareWarning, user: UserX } as const;
const TYPE_LABEL = { project: "Prosjekt", comment: "Kommentar", user: "Profil" } as const;

export default async function AdminPage({ searchParams }: Props) {
  const admin = await getAdmin();
  if (!admin) notFound();

  const { fane, status, q, prosjekt } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(fane ?? "") ? (fane as Tab) : "rapporter";
  const reportStatus = status === "resolved" || status === "dismissed" || status === "all" ? status : "open";

  const [counts, reports, users, focus, metrics, errors, companies, billing, github] = await Promise.all([
    getModerationCounts(),
    tab === "rapporter" ? listReports(reportStatus) : Promise.resolve([]),
    tab === "brukere" ? listUsers(q ?? "") : Promise.resolve([]),
    prosjekt ? getProjectById(prosjekt, admin.id, { asAdmin: true }) : Promise.resolve(null),
    tab === "nokkeltall" ? getKeyMetrics() : Promise.resolve(null),
    tab === "system" ? getErrorSummary() : Promise.resolve(null),
    tab === "bedrifter" ? listCompaniesForAdmin(q ?? "") : Promise.resolve([]),
    tab === "nokkeltall" ? getBillingSummary() : Promise.resolve(null),
    tab === "system" ? getGithubStatus().catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <p className="caption inline-flex items-center gap-2">
          <ShieldCheck className="size-3.5" /> Admin
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{tab === "nokkeltall" ? "Nøkkeltall" : tab === "system" ? "System" : "Moderering"}</h1>

        {(tab === "rapporter" || tab === "brukere") && (
          <dl className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ["Åpne rapporter", counts.openReports],
              ["Rapporter totalt", counts.totalReports],
              ["Fjernede prosjekter", counts.removedProjects],
              ["Stengte kontoer", counts.bannedUsers],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[18px] glass-card p-4">
                <dt className="text-sm text-mist">{label}</dt>
                <dd className="mt-1 text-3xl font-bold tracking-tight">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {focus && (
          <section className="mt-8 rounded-[22px] bg-sea/10 p-5">
            <p className="caption">Moderer prosjekt</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link href={`/prosjekt/${focus.id}`} className="text-lg font-semibold hover:text-ice">
                  {focus.title}
                </Link>
                <p className="text-sm text-mist">
                  av {focus.owner.name} (@{focus.owner.username}){focus.removed && " · fjernet"}
                </p>
              </div>
              <div className="flex gap-2">
                <RemoveProjectButton projectId={focus.id} removed={focus.removed} />
              </div>
            </div>
          </section>
        )}

        <div className="mt-10">
          <Tabs
            label="Moderering"
            active={tab}
            items={[
              { key: "rapporter", label: "Rapporter", href: "/admin", count: counts.openReports },
              { key: "brukere", label: "Brukere", href: "/admin?fane=brukere" },
              { key: "bedrifter", label: "Bedrifter", href: "/admin?fane=bedrifter" },
              { key: "nokkeltall", label: "Nøkkeltall", href: "/admin?fane=nokkeltall" },
              { key: "system", label: "System", href: "/admin?fane=system" },
            ]}
          />
        </div>

        {metrics && <MetricsTab metrics={metrics} billing={billing} />}
        {errors && <SystemTab checks={checkEnv()} errors={errors} github={github} />}

        {tab === "rapporter" ? (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                ["open", "Åpne"],
                ["resolved", "Løste"],
                ["dismissed", "Avviste"],
                ["all", "Alle"],
              ].map(([key, label]) => (
                <Link
                  key={key}
                  href={key === "open" ? "/admin" : `/admin?status=${key}`}
                  className={`rounded-xl border px-3.5 py-1.5 text-sm font-medium transition ${
                    reportStatus === key ? "border-primary bg-primary text-on-primary" : "border-line text-mist hover:text-fg"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            {reports.length === 0 ? (
              <EmptyState className="mt-8" icon={<Flag className="size-5" />} title="Ingen rapporter her">
                Når noen rapporterer innhold, dukker det opp her.
              </EmptyState>
            ) : (
              <ul className="mt-6 space-y-4">
                {reports.map((r) => {
                  const Icon = TYPE_ICON[r.targetType];
                  return (
                    <li key={r.id} className="rounded-[22px] glass-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-2 text-danger">
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-mist">
                              {TYPE_LABEL[r.targetType]} · {REPORT_REASON_LABELS[r.reason]} · <span suppressHydrationWarning>{timeAgo(r.createdAt)}</span>
                              {r.sameTarget > 1 && <span className="ml-2 rounded-md bg-danger/15 px-1.5 py-0.5 font-medium text-danger">{r.sameTarget} rapporter</span>}
                            </p>
                            {r.targetUrl ? (
                              <Link href={r.targetUrl} className="mt-1 block truncate font-semibold text-fg hover:text-ice">
                                {r.targetLabel}
                              </Link>
                            ) : (
                              <p className="mt-1 font-semibold">{r.targetLabel}</p>
                            )}
                            {r.excerpt && <p className="mt-2 line-clamp-3 max-w-2xl rounded-xl bg-ink-2 px-3 py-2 text-sm text-fg/85">«{r.excerpt}»</p>}
                            {r.details && <p className="mt-2 text-sm text-mist">Fra den som rapporterte: {r.details}</p>}
                            <p className="mt-2 text-xs text-mist/80">
                              Rapportert av {r.reporterUsername ? <Link href={`/@${r.reporterUsername}`} className="hover:text-fg">@{r.reporterUsername}</Link> : "slettet bruker"}
                              {r.ownerUsername && (
                                <>
                                  {" "}
                                  · Eier: <Link href={`/@${r.ownerUsername}`} className="hover:text-fg">@{r.ownerUsername}</Link>
                                  {r.ownerBanned && <span className="ml-1 text-danger">(stengt)</span>}
                                </>
                              )}
                            </p>
                            {r.status !== "open" && (
                              <p className="mt-2 text-xs text-success">
                                {r.status === "resolved" ? "Løst" : "Avvist"}
                                {r.resolution && `: ${r.resolution}`}
                              </p>
                            )}
                          </div>
                        </div>
                        {r.status === "open" && (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex flex-wrap justify-end gap-2">
                              {r.targetType === "project" && <RemoveProjectButton projectId={r.targetId} removed={r.projectRemoved} />}
                              {r.targetType === "comment" && r.commentExists && <DeleteCommentButton commentId={r.targetId} />}
                              {r.ownerId && r.ownerName && <BanButton userId={r.ownerId} banned={Boolean(r.ownerBanned)} name={r.ownerName} />}
                            </div>
                            <ResolveButtons reportId={r.id} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : tab === "brukere" ? (
          <>
            <form className="relative mt-6 max-w-md" action="/admin">
              <input type="hidden" name="fane" value="brukere" />
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
              <input name="q" defaultValue={q ?? ""} placeholder="Søk etter navn, brukernavn eller e-post" className={`${inputClass} pl-11`} />
            </form>
            <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Avatar name={u.name} image={u.image} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <Link href={`/@${u.username}`} className="hover:text-ice">
                        {u.name}
                      </Link>
                      <span className="text-sm font-normal text-mist">@{u.username}</span>
                      {u.role === "admin" && <span className="rounded-full bg-sea/15 px-2 py-0.5 text-[11px] font-medium text-sea">admin</span>}
                      {u.banned && <span className="rounded-md bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">stengt</span>}
                    </p>
                    <p className="truncate text-sm text-mist">
                      {u.email} · {u.projects} prosjekter · {u.reports} rapporter · med siden <span suppressHydrationWarning>{timeAgo(u.createdAt)}</span>
                    </p>
                    {u.banned && u.banReason && (
                      <p className="text-xs text-danger">
                        {u.banReason}
                        {u.banExpires && ` · til ${new Date(u.banExpires).toLocaleDateString("nb-NO")}`}
                      </p>
                    )}
                  </div>
                  <GrantPlanButton ownerType="user" ownerId={u.id} name={u.name} current={u.pro} />
                  {u.id !== admin.id && u.role !== "admin" && <BanButton userId={u.id} banned={Boolean(u.banned)} name={u.name} />}
                </li>
              ))}
            </ul>
          </>
        ) : tab === "bedrifter" ? (
          <>
            <form className="relative mt-6 max-w-md" action="/admin">
              <input type="hidden" name="fane" value="bedrifter" />
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
              <input name="q" defaultValue={q ?? ""} placeholder="Søk etter bedrift eller nettside" className={`${inputClass} pl-11`} />
            </form>
            <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
              {companies.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/bedrift/${c.slug}`} className="font-medium hover:text-ice">
                      {c.name}
                    </Link>
                    <p className="truncate text-sm text-mist">
                      {[c.website, `${c.jobs} stillinger`, c.verifiedAt ? "bekreftet" : "ikke bekreftet"].filter(Boolean).join(" · ")} · laget{" "}
                      <span suppressHydrationWarning>{timeAgo(c.createdAt)}</span>
                    </p>
                  </div>
                  <VerifyCompanyButton companyId={c.id} verified={Boolean(c.verifiedAt)} />
                  <GrantPlanButton ownerType="company" ownerId={c.id} name={c.name} current={c.business} />
                </li>
              ))}
              {companies.length === 0 && <li className="px-5 py-6 text-sm text-mist">Ingen bedrifter ennå.</li>}
            </ul>
          </>
        ) : null}
      </div>
    </main>
  );
}
