import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, CalendarClock, Gift, Settings, Trophy } from "lucide-react";
import { EntryForm, HighlightEntry } from "@/components/company/ChallengeTools";
import Markdown from "@/components/Markdown";
import ProjectCard from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/misc";
import { listOwnProjectsForPicker } from "@/lib/applications";
import { getChallenge, getMyEntry, listEntries } from "@/lib/challenges";
import { getMembership } from "@/lib/companies";
import { dateLocale, makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [c, t] = await Promise.all([getChallenge((await params).id), getT()]);
  if (!c) return { title: t("Fant ikke utfordringen") };
  return { title: `${c.title} – ${c.company.name}`, description: t("En utfordring fra {company} på Vis. Svar med et prosjekt.", { company: c.company.name }) };
}

export default async function ChallengePage({ params }: Props) {
  const { id } = await params;
  const [viewer, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = makeT(locale);
  const preview = await getChallenge(id);
  const role = preview ? await getMembership(viewer?.id, preview.companyId) : null;
  const challenge = role ? await getChallenge(id, { asMember: true }) : preview;
  if (!challenge) notFound();
  const [entries, mine, projects] = await Promise.all([
    listEntries(challenge.id),
    getMyEntry(viewer?.id, challenge.id),
    viewer && !role ? listOwnProjectsForPicker(viewer.id) : [],
  ]);
  const deadline = challenge.deadline ? new Date(`${challenge.deadline}T12:00:00`).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0">
            <Link href={`/bedrift/${challenge.company.slug}`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
              <span className="flex size-7 items-center justify-center overflow-hidden rounded-lg bg-fill">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {challenge.company.logoUrl ? <img src={challenge.company.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-4" />}
              </span>
              {challenge.company.name}
              {challenge.company.verifiedAt && <BadgeCheck className="size-4 text-sea" aria-label={t("Bekreftet")} />}
            </Link>
            <p className="caption mt-6 flex items-center gap-2">
              <Trophy className="size-3.5" /> {t("Utfordring")}
            </p>
            <h1 className="display mt-3 text-[clamp(2rem,4.5vw,3.2rem)]">{challenge.title}</h1>
            {!challenge.isOpen && (
              <p className="mt-4 rounded-2xl bg-fill px-4 py-3 text-sm text-mist">{t(challenge.status === "draft" ? "Utkast – bare bedriften ser dette." : "Utfordringen er ikke lenger åpen for svar.")}</p>
            )}
            {challenge.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {challenge.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            )}
            <div className="mt-10">{challenge.description ? <Markdown>{challenge.description}</Markdown> : <p className="text-mist">{t("Ingen beskrivelse.")}</p>}</div>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-[22px] glass-card p-5">
              <dl className="space-y-3 text-sm">
                {challenge.reward && (
                  <div>
                    <dt className="text-mist">{t("Hva du får")}</dt>
                    <dd className="flex items-center gap-1.5 font-medium">
                      <Gift className="size-4 text-success" /> {challenge.reward}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-mist">{t("Frist")}</dt>
                  <dd className="flex items-center gap-1.5 font-medium">
                    <CalendarClock className="size-4 text-mist" /> {deadline ?? t("Løpende")}
                  </dd>
                </div>
              </dl>
              {challenge.isOpen && !role && (
                <div className="mt-5">
                  <EntryForm challengeId={challenge.id} projects={projects} existing={mine} loggedIn={Boolean(viewer)} />
                </div>
              )}
            </section>
            {role && (
              <ButtonLink href={`/bedrift/${challenge.company.slug}/admin/utfordring/${challenge.id}`} variant="secondary" size="sm" className="w-full">
                <Settings className="size-4" /> {t("Rediger utfordringen")}
              </ButtonLink>
            )}
          </aside>
        </div>

        <section className="mt-16">
          <h2 className="caption">{t(entries.length === 1 ? "1 svar" : "{n} svar", { n: entries.length })}</h2>
          {entries.length === 0 ? (
            <p className="mt-4 text-mist">{t("Ingen har svart ennå. Bli den første!")}</p>
          ) : (
            <ul className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((e) => (
                <li key={e.id} className="space-y-2">
                  {(e.highlighted || role) && (
                    <div className="flex items-center justify-between gap-2">
                      {e.highlighted && !role && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/20 px-3 py-1 text-xs font-semibold text-warn">
                          <Trophy className="size-3.5" /> {t("Fremhevet av {company}", { company: challenge.company.name })}
                        </span>
                      )}
                      {role && <HighlightEntry id={e.id} highlighted={e.highlighted} />}
                    </div>
                  )}
                  <ProjectCard project={e.project} />
                  {e.note && <p className="line-clamp-3 px-1 text-sm text-mist">«{e.note}»</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
