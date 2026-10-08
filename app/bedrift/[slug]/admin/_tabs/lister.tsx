import Link from "next/link";
import { ArrowLeft, ChevronRight, Clock, ShieldCheck, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import { UsedTech } from "@/components/company/Applicants";
import { ContactCandidate } from "@/components/company/ContactCandidate";
import { ExportList, ListNote, NewTalentList, TalentListTools } from "@/components/company/ListTools";
import Upsell from "@/components/company/Upsell";
import { EmptyState } from "@/components/ui/misc";
import { getCompanyGate } from "@/lib/company-access";
import { can } from "@/lib/company-permissions";
import { formatDate, timeAgo } from "@/lib/format";
import { getTalentList, listTalentLists } from "@/lib/talent";
import type { AdminCtx } from "./context";

const DAY = 24 * 60 * 60 * 1000;
// Dager til kandidaten fjernes fra listen (12 måneder etter at de ble lagt til).
const daysUntil = (date: Date | string) => Math.ceil((new Date(date).getTime() - Date.now()) / DAY);

// Kandidatlister med notater. Kandidater står i en liste i 12 måneder, og forsvinner med en
// gang de skjuler seg for bedrifter eller blokkerer bedriften (lib/talent.ts).
export default async function ListerTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, base, monthly, canBuy, t, locale, query } = ctx;
  const [lists, list, gate] = await Promise.all([
    listTalentLists(user.id, company.id),
    query.liste ? getTalentList(user.id, query.liste).catch(() => null) : null,
    getCompanyGate(user.id, company.id),
  ]);

  if (!business && lists.length === 0) return <Upsell companyId={company.id} price={monthly} canBuy={canBuy} t={t} />;

  const footer = (
    <p className="mt-6 flex items-center gap-2 text-xs text-mist">
      <ShieldCheck className="size-3.5 shrink-0 text-success" /> {t("Bare kandidater som har sagt ja vises. Alle eksporter logges.")}
    </p>
  );

  if (list && list.companyId === company.id) {
    const canContact = business && can(role, "candidates.contact") && Boolean(gate?.termsAccepted);
    return (
      <section>
        <Link href={`${base}?fane=lister`} scroll={false} className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Alle lister")}
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{list.name}</h2>
            <p className="mt-1 text-sm text-mist">{t("{n} personer", { n: list.members.length })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {business && can(role, "lists.export") && <ExportList listId={list.id} name={list.name} count={list.members.length} />}
            {can(role, "lists.delete") && <TalentListTools listId={list.id} name={list.name} />}
          </div>
        </div>
        {list.members.length === 0 ? (
          <EmptyState className="mt-6" icon={<Users className="size-5" />} title={t("Listen er tom")}>
            {t("Legg til folk fra Kandidatsøk.")}
          </EmptyState>
        ) : (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {list.members.map((m, i) => {
              const left = daysUntil(m.expiresAt);
              return (
                <li key={m.id} className="fade-up flex flex-wrap items-start gap-4 px-5 py-4" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                  <Avatar name={m.name} image={m.image} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                        {m.name}
                      </Link>
                      {left <= 30 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                          <Clock className="size-3" /> {t("Fjernes om {n} d", { n: Math.max(left, 0) })}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-mist">{[m.headline, m.location, t("{n} prosjekter", { n: m.projects })].filter(Boolean).join(" · ")}</p>
                    <UsedTech tech={m.usedTech} max={5} className="mt-1.5" />
                    <p className="mt-1 text-xs text-mist">
                      {m.addedByName
                        ? t("Lagt til {date} av {name}", { date: timeAgo(m.addedAt, locale), name: m.addedByName })
                        : t("Lagt til {date}", { date: timeAgo(m.addedAt, locale) })}
                    </p>
                    <ListNote listId={list.id} userId={m.id} note={m.note} editable={business} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canContact && <ContactCandidate companyId={company.id} userId={m.id} name={m.name} />}
                    {business && <TalentListTools listId={list.id} userId={m.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {footer}
      </section>
    );
  }

  const total = lists.reduce((sum, l) => sum + l.members, 0);
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {business ? <NewTalentList companyId={company.id} /> : <span />}
        {lists.length > 0 && (
          <p className="text-sm text-mist">
            {t("{lists} lister · {n} kandidater", { lists: lists.length, n: total })}
          </p>
        )}
      </div>
      {lists.length === 0 ? (
        <EmptyState className="mt-6" icon={<Users className="size-5" />} title={t("Ingen lister ennå")}>
          {t("Lag en liste, f.eks. «Sommerjobb 2027», og legg til folk fra Kandidatsøk.")}
        </EmptyState>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {lists.map((l, i) => (
            <li key={l.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}>
              <Link href={`${base}?fane=lister&liste=${l.id}`} scroll={false} className="group flex items-center gap-4 rounded-[22px] glass-card p-5 transition-colors hover:bg-fill">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className="mt-0.5 text-xs text-mist">
                    {t("{n} personer", { n: l.members })} · {t("laget {date}", { date: formatDate(l.createdAt, locale, "short") })}
                  </p>
                  {l.preview.length > 0 && (
                    <div className="mt-3 flex -space-x-2">
                      {l.preview.map((p, j) => (
                        <Avatar key={j} name={p.name} image={p.image} size={28} className="ring-2 ring-ink" />
                      ))}
                      {l.members > l.preview.length && (
                        <span className="flex size-7 items-center justify-center rounded-full bg-fill text-[11px] font-semibold tabular-nums text-mist ring-2 ring-ink">
                          +{l.members - l.preview.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-mist transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}
