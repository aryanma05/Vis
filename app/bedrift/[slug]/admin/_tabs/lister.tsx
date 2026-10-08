import Link from "next/link";
import { Download } from "lucide-react";
import Avatar from "@/components/Avatar";
import { ContactCandidate } from "@/components/company/ContactCandidate";
import { NewTalentList, TalentListTools } from "@/components/company/ListTools";
import Upsell from "@/components/company/Upsell";
import { can } from "@/lib/company-permissions";
import { getTalentList, listTalentLists } from "@/lib/talent";
import type { AdminCtx } from "./context";

export default async function ListerTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, base, monthly, canBuy, t, query } = ctx;
  const [lists, list] = await Promise.all([listTalentLists(user.id, company.id), query.liste ? getTalentList(user.id, query.liste).catch(() => null) : null]);

  if (!business && lists.length === 0) return <Upsell companyId={company.id} price={monthly} canBuy={canBuy} t={t} />;

  if (list) {
    return (
      <section>
        <Link href={`${base}?fane=lister`} className="text-sm text-mist hover:text-fg">
          ← {t("Alle lister")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">{list.name}</h2>
          <div className="flex gap-2">
            {business && (
              <a href={`/api/bedrift/liste/${list.id}/csv`} className="inline-flex items-center gap-1.5 rounded-full glass-chip px-3 py-1.5 text-sm font-medium">
                <Download className="size-4" /> {t("Last ned (Excel/CSV)")}
              </a>
            )}
            {can(role, "lists.delete") && <TalentListTools listId={list.id} />}
          </div>
        </div>
        {list.members.length === 0 ? (
          <p className="mt-6 text-mist">{t("Listen er tom. Legg til folk fra Kandidater.")}</p>
        ) : (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {list.members.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                <Avatar name={m.name} image={m.image} size={36} />
                <div className="min-w-0 flex-1">
                  <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                    {m.name}
                  </Link>
                  <p className="truncate text-sm text-mist">{[m.headline, m.location].filter(Boolean).join(" · ")}</p>
                </div>
                {business && <ContactCandidate companyId={company.id} userId={m.id} name={m.name} />}
                <TalentListTools listId={list.id} userId={m.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {business && <NewTalentList companyId={company.id} />}
      {lists.length === 0 ? (
        <p className="text-mist">{t("Ingen lister ennå.")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`${base}?fane=lister&liste=${l.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-fill">
                <span className="font-medium">{l.name}</span>
                <span className="text-sm text-mist">{t("{n} personer", { n: l.members })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
