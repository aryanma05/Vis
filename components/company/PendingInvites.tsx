import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, Building2, Check, Clock, Crown, KeyRound, Minus, TriangleAlert } from "lucide-react";
import InviteResponse from "@/app/invitasjon/[token]/InviteResponse";
import Avatar from "@/components/Avatar";
import { ROLE_TONE } from "@/components/company/tones";
import { listMyInvites } from "@/lib/company-invites";
import { INVITE_KIND_LABELS, ROLE_ACCESS, ROLE_LABEL, type InviteKind } from "@/lib/company-labels";
import type { CompanyRole } from "@/lib/company-permissions";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

const DAY = 86_400_000;
// Hele dager igjen (0 = utløper i dag).
const daysLeft = (date: Date) => Math.max(0, Math.floor((date.getTime() - Date.now()) / DAY));

export type InviteCardData = {
  kind: InviteKind;
  role: CompanyRole | null;
  title: string | null;
  expiresAt: Date;
  company: { name: string; slug: string; logoUrl: string | null; verifiedAt: Date | null };
  inviter: { name: string | null; username: string | null; image: string | null } | null;
};

// «Dette får du tilgang til»: rollens punkter, eller hva det betyr å stå i teamet.
function accessList(invite: InviteCardData, t: T) {
  if (invite.kind === "employee") {
    return [
      { label: t("Profilen og prosjektene dine vises i teamet på bedriftssiden"), ok: true },
      { label: t("Du kan fjerne deg selv når som helst"), ok: true },
      { label: t("Ingen tilgang til stillinger, søkere eller administrasjonen"), ok: false },
    ];
  }
  const role: CompanyRole = invite.kind === "owner" ? "owner" : (invite.role ?? "member");
  return ROLE_ACCESS[role].map((item) => ({ label: t(item.label), ok: item.ok }));
}

// Ett invitasjonskort: logo, bedriften (bekreftet eller ikke), hvem som inviterte, rollen og hva
// den gir tilgang til. Brukes på /varsler, /invitasjoner og /invitasjon/[token]; children er knappene.
export function InviteCard({ invite, t, children, footer }: { invite: InviteCardData; t: T; children: ReactNode; footer?: ReactNode }) {
  const { company } = invite;
  const days = daysLeft(invite.expiresAt);
  const role: CompanyRole | null = invite.kind === "owner" ? "owner" : invite.kind === "member" ? (invite.role ?? "member") : null;
  const by = invite.inviter?.name ?? t("Noen");
  const roleName = role ? t(ROLE_LABEL[role]).toLowerCase() : "";
  return (
    <article className="rounded-[22px] glass-card p-5 ring-1 ring-sea/30 md:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-fill">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {company.logoUrl ? <img src={company.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-5 text-mist" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/bedrift/${company.slug}`} className="truncate text-lg font-semibold tracking-tight hover:text-ice">
              {company.name}
            </Link>
            {company.verifiedAt ? (
              <BadgeCheck className="size-[18px] shrink-0 text-sea" aria-label={t("Bekreftet av Vis")} />
            ) : (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">{t("Ikke bekreftet")}</span>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-mist">
            {invite.inviter && <Avatar name={by} image={invite.inviter.image} size={18} />}
            <span>
              {invite.kind === "owner"
                ? t("{name} vil gjøre deg til eier", { name: by })
                : invite.kind === "employee"
                  ? t("{name} vil vise deg i teamet", { name: by })
                  : t("{name} inviterte deg som {role}", { name: by, role: roleName })}
              {invite.kind === "employee" && invite.title ? ` · ${invite.title}` : ""}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-mist">
          {invite.kind === "owner" ? <Crown className="size-3" aria-hidden="true" /> : invite.kind === "member" ? <KeyRound className="size-3" aria-hidden="true" /> : <Building2 className="size-3" aria-hidden="true" />}
          {t(INVITE_KIND_LABELS[invite.kind])}
        </span>
        {role && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_TONE[role]}`}>{t(ROLE_LABEL[role])}</span>}
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${days < 2 ? "bg-warn/15 text-warn" : "bg-fill text-mist"}`}>
          <Clock className="size-3" aria-hidden="true" /> {days < 1 ? t("Utløper i dag") : t("Utløper om {n} d", { n: days })}
        </span>
      </div>

      <div className="mt-4 rounded-[18px] bg-fill/60 p-4">
        <p className="caption mb-2.5">{t("Dette får du tilgang til")}</p>
        <ul className="space-y-1.5 text-sm">
          {accessList(invite, t).map((item) => (
            <li key={item.label} className={`flex items-start gap-2 ${item.ok ? "text-fg" : "text-mist"}`}>
              {item.ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <Minus className="mt-0.5 size-4 shrink-0 text-mist" aria-hidden="true" />}
              <span>
                <span className="sr-only">{item.ok ? t("Kan:") : t("Kan ikke:")} </span>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {!company.verifiedAt && (
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-mist">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden="true" />
          {t("Bedriften er ikke bekreftet av Vis. Sjekk at du kjenner avsenderen før du sier ja.")}
        </p>
      )}

      <div className="mt-5">{children}</div>
      {footer}
    </article>
  );
}

// Invitasjoner som venter på svar fra innlogget bruker: øverst på /varsler (de tre nyeste og
// «Se alle») og på /invitasjoner (alle). Uten invitasjoner vises empty (eller ingenting).
export default async function PendingInvites({ userId, all = false, empty = null }: { userId: string; all?: boolean; empty?: ReactNode }) {
  const [invites, t] = await Promise.all([listMyInvites(userId), getT()]);
  if (invites.length === 0) return empty;
  const shown = all ? invites : invites.slice(0, 3);
  return (
    <section className={all ? "space-y-4" : "mt-8 space-y-3"} aria-label={t("Invitasjoner")}>
      {!all && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="caption flex items-center gap-2">
            {t("Invitasjoner")}
            <span className="rounded-full bg-sea/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sea">{invites.length}</span>
          </h2>
          <Link href="/invitasjoner" className="text-sm text-mist transition hover:text-fg">
            {t("Se alle")}
          </Link>
        </div>
      )}
      {shown.map((invite, i) => (
        <div key={invite.id} className="fade-up" style={{ animationDelay: `${i * 60}ms` }}>
          <InviteCard invite={invite} t={t}>
            <InviteResponse inviteId={invite.id} kind={invite.kind} companySlug={invite.company.slug} />
          </InviteCard>
        </div>
      ))}
    </section>
  );
}
