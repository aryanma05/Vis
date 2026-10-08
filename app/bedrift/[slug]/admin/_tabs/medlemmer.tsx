import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Clock, Eye, KeyRound, Mail, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import Avatar from "@/components/Avatar";
import InviteDialog from "@/components/company/InviteDialog";
import { InviteActions, MemberMenu, RequireTwoFactor, ShowOnPageSwitch } from "@/components/company/TeamAccess";
import { RemoveEmployee } from "@/components/company/TeamTools";
import { INVITE_TONE, ROLE_TONE } from "@/components/company/tones";
import { listCompanyMembers, listTeam } from "@/lib/companies";
import { getCompanyGate } from "@/lib/company-access";
import { countSeats, listPendingInvites, type PendingInvite } from "@/lib/company-invites";
import { INVITE_KIND_LABELS, INVITE_STATUS_LABELS, ROLE_ACCESS, ROLE_LABEL } from "@/lib/company-labels";
import { assignableRoles, can, COMPANY_ROLES, type CompanyRole } from "@/lib/company-permissions";
import { formatDate } from "@/lib/format";
import type { Locale, T } from "@/lib/i18n";
import type { AdminCtx } from "./context";

const DAY = 86_400_000;

// «Utløper om 6 d», «Utløper i dag» eller «Utløpt».
function expiry(invite: PendingInvite, t: T, locale: Locale) {
  if (invite.status === "expired") return t("Utløpt {date}", { date: formatDate(invite.expiresAt, locale, "short") });
  const days = Math.floor((invite.expiresAt.getTime() - Date.now()) / DAY);
  return days < 1 ? t("Utløper i dag") : t("Utløper om {n} d", { n: days });
}

function RolePill({ role, t }: { role: CompanyRole; t: T }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_TONE[role]}`}>{t(ROLE_LABEL[role])}</span>;
}

// Kort med ikon, tittel, antall og en valgfri knapp oppe til høyre.
function Card({
  icon,
  title,
  count,
  action,
  description,
  children,
  delay,
  className = "",
}: {
  icon: ReactNode;
  title: ReactNode;
  count?: number;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  delay: number;
  className?: string;
}) {
  return (
    <section className={`fade-up rounded-[22px] glass-card p-6 ${className}`} style={{ animationDelay: `${delay * 60}ms` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-fill text-mist [&>svg]:size-[18px]" aria-hidden="true">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-semibold">
              {title}
              {count !== undefined && <span className="rounded-full bg-fill px-2 py-0.5 text-xs font-medium tabular-nums text-mist">{count}</span>}
            </h2>
            {description && <p className="mt-0.5 text-[13px] leading-5 text-mist">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Fanen «Team og tilgang»: hvem som har tilgang og med hvilken rolle, invitasjoner som venter,
// teamet på bedriftssiden, hvem som kan hva, og sikkerhet. Alle kan se hvem som er med;
// invitasjoner, tofaktorstatus og endringer er for eier og administratorer.
export default async function MedlemmerTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, base, t, locale } = ctx;
  const gate = await getCompanyGate(user.id, company.id);
  // Krever bedriften tofaktor og du mangler det, ser du bare hvem som er med (TWO_FACTOR_EXEMPT).
  const locked = Boolean(gate?.needs2fa);
  const canInvite = !locked && can(role, "members.invite");
  const canManage = !locked && can(role, "members.manage");

  const [members, team, invites, seats, teamSeats] = await Promise.all([
    listCompanyMembers(user.id, company.id),
    listTeam(company.id),
    canInvite ? listPendingInvites(user.id, company.id) : Promise.resolve([] as PendingInvite[]),
    countSeats(company.id, "member"),
    countSeats(company.id, "employee"),
  ]);

  const me = members.find((m) => m.userId === user.id);
  const ownerRow = members.find((m) => m.role === "owner");
  const employees = team.filter((m) => !m.admin);
  const onPage = team.filter((m) => m.admin);
  // Plassene: medlemmer pluss ventende invitasjoner til tilgang (det tallet ser bare de som inviterer).
  const pendingMembers = canInvite ? seats.pending : 0;
  const waiting = invites.filter((i) => i.status === "pending").length;
  const taken = members.length + pendingMembers;
  const byRole = COMPANY_ROLES.map((r) => ({ role: r, n: members.filter((m) => m.role === r).length }));
  const with2fa = members.filter((m) => m.twoFactorEnabled).length;
  const without2fa = members.filter((m) => m.twoFactorEnabled === false);
  const assignable = assignableRoles(role);
  const invite = (mode: "member" | "employee", label?: string, variant?: "primary" | "secondary") => (
    <InviteDialog companyId={company.id} assignable={assignable} seats={seats} teamSeats={teamSeats} mode={mode} label={label} variant={variant} />
  );

  return (
    <div className="space-y-6">
      {locked && (
        <div className="fade-up flex items-start gap-3 rounded-[22px] bg-warn/10 px-5 py-4 text-sm ring-1 ring-warn/25">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-fg/90">
            {t("Bedriften krever tofaktorinnlogging. Du ser hvem som er med, men må slå på to-trinns innlogging for å gjøre noe.")}{" "}
            <Link href="/profil/rediger/konto#to-trinn" className="font-medium text-ice hover:underline">
              {t("Slå på to-trinns innlogging")}
            </Link>
          </p>
        </div>
      )}

      {/* Toppen: tall, plasser og roller */}
      <section className="fade-up relative overflow-hidden rounded-[22px] glass-card p-6 md:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="caption">{t("Team og tilgang")}</p>
            <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums">{t(members.length === 1 ? "{n} person med tilgang" : "{n} personer med tilgang", { n: members.length })}</p>
            <p className="mt-1 text-sm text-mist">
              {ownerRow ? t("Eies av {name}", { name: ownerRow.name }) : null}
              {waiting > 0 && <> · {t("{n} venter på svar", { n: waiting })}</>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden -space-x-2 sm:flex" aria-hidden="true">
              {members.slice(0, 5).map((m) => (
                <Avatar key={m.userId} name={m.name} image={m.image} size={32} className="ring-2 ring-ink" />
              ))}
              {members.length > 5 && (
                <span className="flex size-8 items-center justify-center rounded-full bg-fill text-[11px] font-semibold text-mist ring-2 ring-ink">+{members.length - 5}</span>
              )}
            </span>
            {canInvite && invite("member")}
          </div>
        </div>

        <div className="relative mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{t("{n} av {max} plasser", { n: taken, max: seats.max })}</span>
              {pendingMembers > 0 && <span className="text-xs text-mist">{t("{n} reservert av invitasjoner", { n: pendingMembers })}</span>}
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-fill" role="meter" aria-valuemin={0} aria-valuemax={seats.max} aria-valuenow={taken} aria-label={t("Plasser med tilgang")}>
              <div className="h-full bg-sea" style={{ width: `${(members.length / seats.max) * 100}%` }} />
              <div className="h-full bg-sea/40" style={{ width: `${(pendingMembers / seats.max) * 100}%` }} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">{t("Roller")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {byRole
                .filter((r) => r.n > 0)
                .map((r) => (
                  <span key={r.role} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_TONE[r.role]}`}>
                    {t(ROLE_LABEL[r.role])} <span className="tabular-nums opacity-80">{r.n}</span>
                  </span>
                ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">{t("{n} vises på bedriftssiden", { n: team.length })}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex -space-x-2" aria-hidden="true">
                {team.slice(0, 6).map((m) => (
                  <Avatar key={m.userId} name={m.name} image={m.image} size={24} className="ring-2 ring-ink" />
                ))}
              </span>
              {team.length === 0 && <span className="text-xs text-mist">{t("Ingen ennå")}</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Tilgang */}
          <Card
            delay={1}
            icon={<KeyRound />}
            title={t("Tilgang")}
            count={members.length}
            description={t("Kan logge inn i administrasjonen. Hva de kan gjøre, styres av rollen.")}
          >
            <ul className="-mx-2">
              {members.map((m, i) => {
                const self = m.userId === user.id;
                return (
                  <li
                    key={m.userId}
                    className="fade-up flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition hover:bg-fill"
                    style={{ animationDelay: `${120 + i * 40}ms` }}
                  >
                    <Avatar name={m.name} image={m.image} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/@${m.username}`} className="truncate font-medium hover:text-ice">
                          {m.name}
                        </Link>
                        {self && <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-mist">{t("Deg")}</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-mist">
                        @{m.username} · {t("med siden {date}", { date: formatDate(m.createdAt, locale, "short") })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m.showOnPage && (
                        <span title={t("Vises på bedriftssiden")} className="text-mist">
                          <Eye className="size-4" aria-hidden="true" />
                          <span className="sr-only">{t("Vises på bedriftssiden")}</span>
                        </span>
                      )}
                      {m.twoFactorEnabled !== null && (
                        <span title={m.twoFactorEnabled ? t("Har tofaktor") : t("Mangler tofaktor")} className={m.twoFactorEnabled ? "text-success" : "text-mist/60"}>
                          {m.twoFactorEnabled ? <ShieldCheck className="size-4" aria-hidden="true" /> : <ShieldAlert className="size-4" aria-hidden="true" />}
                          <span className="sr-only">{m.twoFactorEnabled ? t("Har tofaktor") : t("Mangler tofaktor")}</span>
                        </span>
                      )}
                      <RolePill role={m.role} t={t} />
                      {!locked && (
                        <MemberMenu
                          companyId={company.id}
                          companySlug={company.slug}
                          member={{ userId: m.userId, name: m.name, role: m.role }}
                          viewerRole={role}
                          self={self}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Venter på svar */}
          {canInvite && (
            <Card
              delay={2}
              icon={<Clock />}
              title={t("Venter på svar")}
              count={invites.length}
              description={t("Plassen holdes av til invitasjonen er besvart eller utløper etter 7 dager.")}
            >
              {invites.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-fill px-4 py-3.5 text-sm text-mist">
                  <span>{t("Ingen invitasjoner venter. Inviter med @brukernavn eller e-post.")}</span>
                  {invite("member", t("Inviter"), "secondary")}
                </div>
              ) : (
                <ul className="-mx-2">
                  {invites.map((inv, i) => {
                    const label = inv.invitee?.name ?? inv.email ?? "";
                    return (
                      <li key={inv.id} className="fade-up flex flex-wrap items-center gap-3 rounded-[14px] px-2 py-2.5 transition hover:bg-fill" style={{ animationDelay: `${180 + i * 40}ms` }}>
                        {inv.invitee ? (
                          <Avatar name={inv.invitee.name} image={inv.invitee.image} size={40} />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-mist" aria-hidden="true">
                            <Mail className="size-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="truncate font-medium">{label}</span>
                            {inv.kind === "member" && inv.role ? (
                              <RolePill role={inv.role} t={t} />
                            ) : (
                              <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-mist">{t(INVITE_KIND_LABELS[inv.kind])}</span>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] text-mist">
                            {inv.invitee ? `@${inv.invitee.username}` : t("Personlig lenke på e-post")}
                            {inv.title ? ` · ${inv.title}` : ""}
                            {inv.invitedBy ? ` · ${t("invitert av {name}", { name: inv.invitedBy })}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVITE_TONE[inv.status]}`}>{t(INVITE_STATUS_LABELS[inv.status])}</span>
                          <span className="text-xs tabular-nums text-mist">{expiry(inv, t, locale)}</span>
                          {inv.canManage && <InviteActions inviteId={inv.id} label={label} expired={inv.status === "expired"} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {/* Team på bedriftssiden */}
          <Card
            delay={3}
            icon={<Building2 />}
            title={t("Team på bedriftssiden")}
            count={team.length}
            description={t("Vises med prosjektene sine på bedriftssiden. Gir ingen tilgang til administrasjonen.")}
            action={canInvite ? invite("employee", t("Legg til i teamet"), "secondary") : undefined}
          >
            {team.length === 0 ? (
              <p className="rounded-[18px] bg-fill px-4 py-3.5 text-sm text-mist">
                {t("Ingen i teamet ennå. Utviklere stoler mer på kollegaer enn på reklame, så inviter noen som jobber hos dere.")}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {[...employees, ...onPage].map((m, i) => (
                  <li
                    key={m.userId}
                    className="fade-up flex items-center gap-3 rounded-[16px] bg-fill/60 px-3 py-2.5"
                    style={{ animationDelay: `${240 + i * 30}ms` }}
                  >
                    <Avatar name={m.name} image={m.image} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/@${m.username}`} className="block truncate text-sm font-medium hover:text-ice">
                        {m.name}
                      </Link>
                      <p className="truncate text-xs text-mist">{m.title ?? m.headline ?? `@${m.username}`}</p>
                    </div>
                    {m.admin ? (
                      <span title={t("Har tilgang og har valgt å vises")} className="shrink-0 text-mist">
                        <KeyRound className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">{t("Har tilgang og har valgt å vises")}</span>
                      </span>
                    ) : (
                      canManage && <RemoveEmployee companyId={company.id} userId={m.userId} name={m.name} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {/* Sikkerhet */}
          <Card delay={2} icon={<ShieldCheck />} title={t("Sikkerhet")}>
            <div className="space-y-4">
              {role === "owner" && !locked ? (
                <RequireTwoFactor
                  companyId={company.id}
                  enabled={company.require2fa}
                  business={business}
                  ownerHas2fa={Boolean(me?.twoFactorEnabled)}
                  abonnementHref={`${base}?fane=abonnement`}
                />
              ) : (
                <p className="flex items-start gap-2 text-sm">
                  {company.require2fa ? <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0 text-mist" aria-hidden="true" />}
                  <span className={company.require2fa ? "text-fg" : "text-mist"}>
                    {company.require2fa ? t("Bedriften krever tofaktor for alle.") : t("Tofaktor er valgfritt. Eieren kan kreve det (Bedrift).")}
                  </span>
                </p>
              )}
              {canManage && (
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{t("{n} av {total} har tofaktor", { n: with2fa, total: members.length })}</span>
                    {company.require2fa && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">{t("Påkrevd")}</span>}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden="true">
                    <div className={`h-full rounded-full ${with2fa === members.length ? "bg-success" : "bg-warn"}`} style={{ width: `${(with2fa / Math.max(1, members.length)) * 100}%` }} />
                  </div>
                </div>
              )}
              {canManage && without2fa.length > 0 && (
                <div className="rounded-[16px] bg-fill px-4 py-3">
                  <p className="text-[13px] font-medium">{t("{n} mangler tofaktor", { n: without2fa.length })}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="flex -space-x-2" aria-hidden="true">
                      {without2fa.slice(0, 6).map((m) => (
                        <Avatar key={m.userId} name={m.name} image={m.image} size={24} className="ring-2 ring-ink" />
                      ))}
                    </span>
                    <span className="truncate text-xs text-mist">{without2fa.slice(0, 3).map((m) => m.name.split(/\s+/)[0]).join(", ")}</span>
                  </div>
                </div>
              )}
              {canManage && without2fa.length === 0 && members.length > 0 && (
                <p className="flex items-center gap-2 text-[13px] text-success">
                  <ShieldCheck className="size-4" aria-hidden="true" /> {t("Alle har tofaktor")}
                </p>
              )}
            </div>
          </Card>

          {/* Deg på bedriftssiden */}
          {me && (
            <Card delay={3} icon={<Eye />} title={t("Deg på bedriftssiden")}>
              <ShowOnPageSwitch companyId={company.id} enabled={me.showOnPage} />
            </Card>
          )}
        </aside>
      </div>

      {/* Hvem kan hva */}
      <section className="fade-up rounded-[22px] glass-card p-6" style={{ animationDelay: "240ms" }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("Hvem kan hva")}</h2>
            <p className="mt-0.5 text-[13px] text-mist">{t("Gi hver person den laveste rollen som holder. Vurderere ser aldri kontaktinfo.")}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMPANY_ROLES.map((r) => {
            const mine = r === role;
            const n = byRole.find((b) => b.role === r)?.n ?? 0;
            return (
              <div key={r} className={`rounded-[18px] p-4 ${mine ? "bg-sea/10 ring-1 ring-sea/30" : "bg-fill/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <RolePill role={r} t={t} />
                  <span className="text-xs tabular-nums text-mist">{mine ? t("Din rolle") : t(n === 1 ? "{n} person" : "{n} personer", { n })}</span>
                </div>
                <ul className="mt-3 space-y-2 text-[13px] leading-5">
                  {ROLE_ACCESS[r].map((item) => (
                    <li key={item.label} className={`flex items-start gap-2 ${item.ok ? "text-fg" : "text-mist"}`}>
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${item.ok ? "tone tone-success" : "bg-fill text-mist"}`}
                        aria-hidden="true"
                      >
                        {item.ok ? "✓" : "–"}
                      </span>
                      <span>
                        <span className="sr-only">{item.ok ? t("Kan:") : t("Kan ikke:")} </span>
                        {t(item.label)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trygghet */}
      <p className="fade-up flex items-start gap-3 rounded-[18px] bg-fill px-5 py-4 text-sm text-mist" style={{ animationDelay: "300ms" }}>
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          {t("Ingen får tilgang eller vises på bedriftssiden før de har sagt ja. Alle endringer logges.")}
          {can(role, "audit.view") && !locked && (
            <>
              {" "}
              <Link href={`${base}?fane=personvern`} className="inline-flex items-center gap-1 font-medium text-ice hover:underline">
                <ScrollText className="size-3.5" aria-hidden="true" /> {t("Se aktivitetsloggen")}
              </Link>
            </>
          )}
        </span>
      </p>
    </div>
  );
}
