import Link from "next/link";
import Avatar from "@/components/Avatar";
import { AddMember, RemoveMember } from "@/components/company/TeamAccess";
import { AddEmployee, RemoveEmployee } from "@/components/company/TeamTools";
import { listCompanyMembers, listTeam } from "@/lib/companies";
import { ROLE_LABEL } from "@/lib/company-labels";
import { can } from "@/lib/company-permissions";
import type { AdminCtx } from "./context";

export default async function MedlemmerTab({ ctx }: { ctx: AdminCtx }) {
  const { company, role, t } = ctx;
  const [members, team] = await Promise.all([listCompanyMembers(company.id), listTeam(company.id)]);
  const canManage = can(role, "members.manage");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("Team på bedriftssiden")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-mist">
          {t("Folk som jobber hos dere, med prosjektene sine på bedriftssiden. Utviklere stoler mer på kollegaer enn på reklame. Å stå i teamet gir ingen tilgang til å administrere bedriften.")}
        </p>
      </div>
      {canManage && <AddEmployee companyId={company.id} />}
      {team.filter((m) => !m.admin).length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
          {team
            .filter((m) => !m.admin)
            .map((m) => (
              <li key={m.userId} className="flex items-center gap-4 px-5 py-3">
                <Avatar name={m.name} image={m.image} size={36} />
                <div className="min-w-0 flex-1">
                  <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                    {m.name}
                  </Link>
                  <p className="text-sm text-mist">{m.title ?? m.headline ?? `@${m.username}`}</p>
                </div>
                {canManage && <RemoveEmployee companyId={company.id} userId={m.userId} />}
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-mist">{t("Ingen i teamet ennå. Medlemmene under vises også på bedriftssiden.")}</p>
      )}

      <div className="pt-4">
        <h2 className="text-lg font-semibold">{t("Medlemmer")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-mist">
          {t("Kan legge ut stillinger, se søkere og bruke kandidatsøket. Eier og administratorer kan også endre bedriftsprofilen og abonnementet.")}
        </p>
      </div>
      {canManage && <AddMember companyId={company.id} />}
      <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-4 px-5 py-3">
            <Avatar name={m.name} image={m.image} size={36} />
            <div className="min-w-0 flex-1">
              <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                {m.name}
              </Link>
              <p className="text-sm text-mist">{t(ROLE_LABEL[m.role])}</p>
            </div>
            {canManage && m.role !== "owner" && <RemoveMember companyId={company.id} userId={m.userId} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
