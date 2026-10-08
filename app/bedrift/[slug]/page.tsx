import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Building2, Gift, MapPin, Settings, Trophy, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import JobList from "@/components/company/JobList";
import { RemoveEmployee } from "@/components/company/TeamTools";
import Markdown from "@/components/Markdown";
import ProjectCard from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/button";
import { listCompanyChallenges } from "@/lib/challenges";
import { getCompanyBySlug, getMembership, getTeamProjects, getTeamTools, listTeam } from "@/lib/companies";
import { listCompanyJobs } from "@/lib/jobs";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [company, t] = await Promise.all([getCompanyBySlug((await params).slug), getT()]);
  if (!company) return { title: t("Fant ikke bedriften") };
  return { title: company.name, description: company.about?.slice(0, 160) ?? t("{name} på Vis: ledige stillinger og folk.", { name: company.name }) };
}

const host = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const [viewer, t] = await Promise.all([getCurrentUser(), getT()]);
  const [role, jobs, team, challenges] = await Promise.all([
    getMembership(viewer?.id, company.id),
    listCompanyJobs(company.id),
    listTeam(company.id),
    listCompanyChallenges(company.id),
  ]);
  const [projects, tools] = await Promise.all([getTeamProjects(team, 6), getTeamTools(company.id, team)]);
  const viewerInTeam = viewer ? team.some((m) => m.userId === viewer.id && !m.admin) : false;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start gap-5">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-fill">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {company.logoUrl ? <img src={company.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-7 text-mist" />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-4xl font-bold tracking-tight">
              {company.name}
              {company.verifiedAt && <BadgeCheck className="size-6 text-sea" aria-label={t("Bekreftet av Vis")} />}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-mist">
              {company.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {company.location}
                </span>
              )}
              {company.size && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" /> {t("{n} ansatte", { n: company.size })}
                </span>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ice hover:underline">
                  {host(company.website)} <ArrowUpRight className="size-3.5" />
                </a>
              )}
            </p>
          </div>
          {role && (
            <ButtonLink href={`/bedrift/${company.slug}/admin`} variant="secondary" size="sm">
              <Settings className="size-4" /> {t("Administrer")}
            </ButtonLink>
          )}
        </header>

        <dl className="mt-8 grid max-w-xl grid-cols-3 divide-x divide-line overflow-hidden rounded-[18px] glass-card text-center">
          {[
            { label: t("folk på Vis"), value: team.length },
            { label: t("ledige stillinger"), value: jobs.length },
            { label: t("utfordringer"), value: challenges.length },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse px-2 py-3">
              <dt className="text-[11px] text-mist">{s.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-12">
            <section>
              <h2 className="caption">{t("Ledige stillinger")}</h2>
              <div className="mt-4">
                {jobs.length > 0 ? <JobList jobs={jobs} showCompany={false} /> : <p className="text-mist">{t("Ingen ledige stillinger akkurat nå.")}</p>}
              </div>
            </section>
            {challenges.length > 0 && (
              <section>
                <h2 className="caption">{t("Utfordringer")}</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {challenges.map((c) => (
                    <li key={c.id}>
                      <Link href={`/utfordringer/${c.id}`} className="block rounded-[22px] glass-card p-4 transition hover:bg-card-hover">
                        <span className="flex items-center gap-2 font-semibold">
                          <Trophy className="size-4 text-warn" /> {c.title}
                        </span>
                        {c.reward && (
                          <span className="mt-1.5 flex items-center gap-1.5 text-sm text-success">
                            <Gift className="size-3.5" /> {c.reward}
                          </span>
                        )}
                        <span className="mt-1.5 block text-sm text-mist">{t(c.entries === 1 ? "1 svar" : "{n} svar", { n: c.entries })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {projects.length > 0 && (
              <section>
                <h2 className="caption">{t("Laget av teamet")}</h2>
                <p className="mt-2 text-sm text-mist">{t("Prosjekter fra folk som jobber i {name}.", { name: company.name })}</p>
                <ul className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <ProjectCard project={p} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {company.about && (
              <section>
                <h2 className="caption">{t("Om {name}", { name: company.name })}</h2>
                <div className="mt-4">
                  <Markdown>{company.about}</Markdown>
                </div>
              </section>
            )}
          </div>
          <aside className="space-y-6">
            {tools.length > 0 && (
              <section className="rounded-[22px] glass-card p-5">
                <h2 className="caption">{t("Verktøy vi bruker")}</h2>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {tools.map((tool) => (
                    <span key={tool.name} className="rounded-full bg-fill px-2.5 py-1 text-xs font-medium">
                      {tool.name}
                    </span>
                  ))}
                </p>
                <p className="mt-3 text-xs text-mist">{t("Fra teamets prosjekter og stillingene.")}</p>
              </section>
            )}
            <section className="rounded-[22px] glass-card p-5">
              <h2 className="caption">{t("Folk på Vis")}</h2>
              <ul className="mt-3 space-y-3">
                {team.map((m) => (
                  <li key={m.userId}>
                    <Link href={`/@${m.username}`} className="flex items-center gap-3 hover:text-ice">
                      <Avatar name={m.name} image={m.image} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        {(m.title ?? m.headline) && <span className="block truncate text-xs text-mist">{m.title ?? m.headline}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {viewerInTeam && (
                <div className="mt-4 border-t border-line pt-3">
                  <RemoveEmployee companyId={company.id} self />
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
