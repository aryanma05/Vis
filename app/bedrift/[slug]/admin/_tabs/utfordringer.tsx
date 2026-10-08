import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { ChallengeActions } from "@/components/company/ChallengeTools";
import Upsell from "@/components/company/Upsell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { listCompanyChallenges } from "@/lib/challenges";
import { can } from "@/lib/company-permissions";
import { formatDate } from "@/lib/format";
import type { AdminCtx } from "./context";

export default async function UtfordringerTab({ ctx }: { ctx: AdminCtx }) {
  const { company, role, business, base, monthly, canBuy, t, locale } = ctx;
  const challenges = await listCompanyChallenges(company.id, { includeAll: true });
  const canManage = can(role, "challenges.manage");

  if (!business && challenges.length === 0) return <Upsell companyId={company.id} price={monthly} canBuy={canBuy} t={t} feature="utfordringer" />;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-mist">
          {t("Legg ut en liten oppgave, og la folk svare med et prosjekt. Fungerer som et lite hackathon, og passer perfekt for sommerjobb og internship.")}
        </p>
        {canManage && business && (
          <ButtonLink href={`${base}/utfordring/ny`} size="sm">
            <Plus className="size-4" /> {t("Ny utfordring")}
          </ButtonLink>
        )}
      </div>
      {challenges.length === 0 ? (
        <EmptyState className="mt-6" icon={<Trophy className="size-5" />} title={t("Ingen utfordringer ennå")}>
          {t("F.eks. «Lag en landingsside for en sykkelbutikk» eller «Visualiser bysykkel-data for Oslo». Den vises under Utfordringer og på bedriftssiden.")}
        </EmptyState>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
          {challenges.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <Link href={`/utfordringer/${c.id}`} className="font-semibold hover:text-ice">
                  {c.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-mist">
                  <span className={c.status === "published" ? "text-success" : c.status === "draft" ? "text-warn" : ""}>
                    {c.status === "published" ? t("Publisert") : c.status === "draft" ? t("Utkast") : t("Lukket")}
                  </span>
                  <span>{t(c.entries === 1 ? "1 svar" : "{n} svar", { n: c.entries })}</span>
                  {c.deadline && <span>{t("Frist {date}", { date: formatDate(`${c.deadline}T12:00:00`, locale) })}</span>}
                  {canManage && (
                    <Link href={`${base}/utfordring/${c.id}`} className="text-ice hover:underline">
                      {t("Rediger")}
                    </Link>
                  )}
                </p>
              </div>
              {canManage && <ChallengeActions id={c.id} status={c.status} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
