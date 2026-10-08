import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, CalendarClock, Gift, Trophy, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Tag } from "@/components/ui/misc";
import { listOpenChallenges } from "@/lib/challenges";
import { dateLocale, makeT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLocale());
  return { title: t("Utfordringer"), description: t("Små oppgaver fra bedrifter. Svar med et prosjekt, og vis hva du kan.") };
}

// Åpne utfordringer fra bedrifter. Man svarer med et prosjekt på Vis.
export default async function ChallengesPage() {
  const [challenges, locale] = await Promise.all([listOpenChallenges(), getLocale()]);
  const t = makeT(locale);
  const date = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long" });

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="caption">{t("Vis hva du kan")}</p>
            <h1 className="display mt-3 text-[clamp(2.2rem,5vw,3.6rem)]">{t("Utfordringer")}</h1>
            <p className="mt-3 text-mist">
              {t("Bedrifter legger ut små oppgaver, og du svarer med et prosjekt på Vis. Ingen kodetest bak lukkede dører: svaret ditt blir et prosjekt du kan vise frem uansett.")}
            </p>
          </div>
          <ButtonLink href="/stillinger" variant="secondary">
            {t("Ledige stillinger")}
          </ButtonLink>
        </div>

        {challenges.length === 0 ? (
          <EmptyState className="mt-10" icon={<Trophy className="size-5" />} title={t("Ingen åpne utfordringer akkurat nå")}>
            {t("Bedrifter med Bedrift-abonnement kan legge ut utfordringer fra administrasjonen.")}
          </EmptyState>
        ) : (
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {challenges.map((c) => (
              <li key={c.id}>
                <Link href={`/utfordringer/${c.id}`} className="flex h-full flex-col rounded-[22px] glass-card p-5 transition hover:bg-card-hover">
                  <span className="flex items-center gap-2 text-sm text-mist">
                    <span className="flex size-7 items-center justify-center overflow-hidden rounded-lg bg-fill">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.company.logoUrl ? <img src={c.company.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-4" />}
                    </span>
                    {c.company.name}
                    {c.company.verifiedAt && <BadgeCheck className="size-4 text-sea" aria-label={t("Bekreftet")} />}
                  </span>
                  <span className="mt-3 text-xl font-semibold tracking-tight">{c.title}</span>
                  {c.reward && (
                    <span className="mt-2 inline-flex items-center gap-1.5 text-sm text-success">
                      <Gift className="size-4" /> {c.reward}
                    </span>
                  )}
                  {c.tags.length > 0 && (
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {c.tags.slice(0, 5).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </span>
                  )}
                  <span className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-sm text-mist">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" /> {t(c.entries === 1 ? "1 svar" : "{n} svar", { n: c.entries })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-4" /> {c.deadline ? t("Frist {date}", { date: date(c.deadline) }) : t("Løpende")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
