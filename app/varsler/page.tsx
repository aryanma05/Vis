import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, Bell, Bookmark, Briefcase, Building2, CalendarCheck, CalendarX, Crown, HandHeart, Handshake, Heart, KeyRound, Lightbulb, LogOut, Mail, MessageCircle, Reply, Settings, Sparkles, Star, Trophy, UserCheck, UserMinus, UserPlus, Users, UserX } from "lucide-react";
import Avatar from "@/components/Avatar";
import PendingInvites from "@/components/company/PendingInvites";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/company-labels";
import { APPLICATION_STATUS_LABELS, CONTACT_REASON_LABELS, type ApplicationStatus } from "@/lib/constants";
import { dateLocale, type Locale, type T } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { listNotifications, type NotificationItem } from "@/lib/notifications";
import { requireUser } from "@/lib/session";
import MarkRead from "./MarkRead";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Varsler"), robots: { index: false } };
}

function describe(n: NotificationItem, t: T, locale: Locale) {
  const project = <b className="font-semibold text-fg">{n.project?.title ?? t("et prosjekt")}</b>;
  switch (n.type) {
    case "comment":
      return { Icon: MessageCircle, tone: "text-ice", text: <>{t("kommenterte på")} {project}</> };
    case "reply":
      return { Icon: Reply, tone: "text-ice", text: <>{t("svarte deg på")} {project}</> };
    case "mention":
      return { Icon: AtSign, tone: "text-ice", text: <>{t("nevnte deg på")} {project}</> };
    case "follow":
      return { Icon: UserPlus, tone: "text-success", text: <>{t("begynte å følge deg")}</> };
    case "contact":
      return {
        Icon: Mail,
        tone: "text-success",
        text: (
          <>
            {t("vil komme i kontakt")}
            {n.contactReason ? ` (${t(CONTACT_REASON_LABELS[n.contactReason]).toLowerCase()})` : ""}
          </>
        ),
      };
    case "member":
      return { Icon: Users, tone: "text-success", text: <>{t("la deg til som medlem i")} {project}</> };
    case "featured":
      return { Icon: Sparkles, tone: "text-warn", text: <>{t("valgte ut")} {project}. {t("Det vises nå på forsiden.")}</> };
    case "application": {
      const job = <b className="font-semibold text-fg">{n.data.jobTitle ?? t("en stilling")}</b>;
      if (n.data.event === "withdrawn") return { Icon: UserMinus, tone: "text-mist", text: <>{t("trakk søknaden på")} {job}</> };
      if (n.data.event === "job_closed") return { Icon: Briefcase, tone: "text-mist", text: <>{t("har fjernet stillingen")} {job}. {t("Søknaden din er avsluttet.")}</> };
      if (n.data.event === "mention") return { Icon: AtSign, tone: "text-ice", text: <>{t("nevnte deg i et notat om en søker på")} {job}</> };
      if (n.data.event === "status") {
        const status = t(APPLICATION_STATUS_LABELS[(n.data.status ?? "ny") as ApplicationStatus]);
        return {
          Icon: Briefcase,
          tone: n.data.status === "avslag" ? "text-mist" : "text-success",
          text: (
            <>
              {t("har oppdatert søknaden din på")} {job}: <b className="font-semibold text-fg">{status}</b>
            </>
          ),
        };
      }
      return { Icon: Briefcase, tone: "text-ice", text: <>{t("søkte på")} {job} {t("med Vis-profilen")}</> };
    }
    case "employee":
      return { Icon: Building2, tone: "text-success", text: <>{t("la deg til i teamet på bedriftssiden. Prosjektene dine vises der nå.")}</> };
    case "challenge":
      return n.data.event === "highlight"
        ? { Icon: Trophy, tone: "text-warn", text: <>{t("fremhevet svaret ditt på utfordringen")} <b className="font-semibold text-fg">{n.data.challengeTitle}</b></> }
        : { Icon: Trophy, tone: "text-ice", text: <>{t("svarte på utfordringen")} <b className="font-semibold text-fg">{n.data.challengeTitle}</b></> };
    case "company_invite": {
      const company = <b className="font-semibold text-fg">{n.data.companyName ?? t("en bedrift")}</b>;
      if (n.data.inviteKind === "owner") return { Icon: Crown, tone: "text-warn", text: <>{t("vil gjøre deg til eier av")} {company}</> };
      if (n.data.inviteKind === "employee") return { Icon: Building2, tone: "text-ice", text: <>{t("inviterte deg til teamet på bedriftssiden til")} {company}</> };
      return {
        Icon: KeyRound,
        tone: "text-ice",
        text: (
          <>
            {t("inviterte deg til")} {company} {n.data.role ? t("som {role}", { role: t(ROLE_LABEL[n.data.role]).toLowerCase() }) : ""}
          </>
        ),
      };
    }
    case "company_access": {
      const company = <b className="font-semibold text-fg">{n.data.companyName ?? t("en bedrift")}</b>;
      switch (n.data.event) {
        case "accepted":
          return { Icon: UserCheck, tone: "text-success", text: <>{t("godtok invitasjonen til")} {company}</> };
        case "declined":
          return { Icon: UserX, tone: "text-mist", text: <>{t("avslo invitasjonen til")} {company}</> };
        case "role":
          return {
            Icon: KeyRound,
            tone: "text-ice",
            text: (
              <>
                {t("endret rollen din til")} <b className="font-semibold text-fg">{t(ROLE_LABEL[n.data.role ?? "member"])}</b>
              </>
            ),
          };
        case "removed":
          return { Icon: UserMinus, tone: "text-mist", text: <>{t("fjernet tilgangen din til administrasjonen")}</> };
        case "left":
          return { Icon: LogOut, tone: "text-mist", text: <>{t("forlot")} {company}</> };
        default:
          return { Icon: Crown, tone: "text-warn", text: <>{t("gjorde deg til eier av bedriften")}</> };
      }
    }
    case "interview": {
      const job = <b className="font-semibold text-fg">{n.data.jobTitle ?? t("en stilling")}</b>;
      const when = n.data.startsAt
        ? new Date(n.data.startsAt).toLocaleString(dateLocale(locale), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" })
        : null;
      if (n.data.event === "company_cancelled") return { Icon: CalendarX, tone: "text-warn", text: <>{t("avlyste intervjuet for")} {job}. {t("Velg en ny tid.")}</> };
      if (n.data.event === "cancelled") return { Icon: CalendarX, tone: "text-mist", text: <>{t("avbestilte intervjuet for")} {job}</> };
      return {
        Icon: CalendarCheck,
        tone: "text-success",
        text: (
          <>
            {t("booket intervju for")} {job}
            {when ? ` (${when})` : ""}
          </>
        ),
      };
    }
    case "talent":
      return { Icon: Bookmark, tone: "text-ice", text: <>{t("lagret profilen din i en kandidatliste")}</> };
    case "partner_request":
      return { Icon: HandHeart, tone: "text-warn", text: <>{t("vil hjelpe med")} <b className="font-semibold text-fg">{n.partnerPost?.title ?? t("et prosjekt")}</b></> };
    case "partner_accepted":
      return {
        Icon: Handshake,
        tone: "text-success",
        text: (
          <>
            {t("sa ja til at du blir med på")} <b className="font-semibold text-fg">{n.partnerPost?.title ?? t("et prosjekt")}</b>
          </>
        ),
      };
    case "reaction": {
      const Icon = n.reaction === "Nyttig" ? Lightbulb : n.reaction === "Inspirerende" ? Star : Heart;
      return {
        Icon,
        tone: "text-[#ff9fb5]",
        text: (
          <>
            {t("synes")} {project} {n.reaction === "Nyttig" ? t("er nyttig") : n.reaction === "Inspirerende" ? t("er inspirerende") : t("er bra")}
          </>
        ),
      };
    }
  }
}

function href(n: NotificationItem) {
  if (n.type === "contact" && n.contactId) return `/kontakt/${n.contactId}`;
  if (n.type === "application") {
    return n.data.event === "status" || n.data.event === "job_closed" ? "/soknader" : `/bedrift/${n.data.companySlug}/admin/soker/${n.data.applicationId}`;
  }
  if (n.type === "employee") return `/bedrift/${n.data.companySlug}`;
  if (n.type === "company_invite") return "/invitasjoner";
  if (n.type === "company_access") return n.data.event === "removed" ? `/bedrift/${n.data.companySlug}` : `/bedrift/${n.data.companySlug}/admin?fane=medlemmer`;
  // Verten går til søkeren; kandidaten til søknadene sine.
  if (n.type === "interview") return n.data.event === "company_cancelled" ? "/soknader" : `/bedrift/${n.data.companySlug}/admin/soker/${n.data.applicationId}`;
  if (n.type === "talent") return "/profil/rediger/konto/bedrifter";
  if (n.type === "challenge") return `/utfordringer/${n.data.challengeId}`;
  if (n.type === "partner_request" && n.partnerPost) return `/partnere/${n.partnerPost.id}#foresporsler`;
  if (n.type === "partner_accepted" && n.partnerPost) return `/partnere/${n.partnerPost.id}`;
  if (n.type === "follow" || !n.project) return `/@${n.actor.username}`;
  if (n.commentId) return `/prosjekt/${n.project.id}#kommentar-${n.commentId}`;
  return `/prosjekt/${n.project.id}`;
}

// Statusendringer, team, fremhevede svar, tilgang, avlyste intervjuer og kandidatlister kommer
// fra bedriften, ikke fra personen som trykket.
function actorName(n: NotificationItem, t: T) {
  if (n.type === "featured") return t("Redaksjonen");
  const fromCompany =
    (n.type === "application" && (n.data.event === "status" || n.data.event === "job_closed")) ||
    n.type === "employee" ||
    (n.type === "challenge" && n.data.event === "highlight") ||
    (n.type === "company_access" && (n.data.event === "role" || n.data.event === "removed" || n.data.event === "ownership")) ||
    (n.type === "interview" && n.data.event === "company_cancelled") ||
    n.type === "talent";
  return fromCompany ? (n.data.companyName ?? n.actor.name) : n.actor.name;
}

function dayLabel(date: Date) {
  const d = new Date(date);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return "I dag";
  if (diff === 1) return "I går";
  if (diff < 7) return "Denne uka";
  if (diff < 30) return "Denne måneden";
  return "Tidligere";
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ vis?: string }> }) {
  const user = await requireUser();
  const [{ vis }, t, locale] = await Promise.all([searchParams, getT(), getLocale()]);
  const unreadOnly = vis === "uleste";
  const notifications = await listNotifications(user.id, { unreadOnly });
  const hasUnread = notifications.some((n) => n.unread);

  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const n of notifications) {
    const label = dayLabel(n.createdAt);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <MarkRead hasUnread={hasUnread} />
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="caption">{t("Innboks")}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{t("Varsler")}</h1>
          </div>
          <Link href="/profil/rediger/konto#varsler" className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
            <Settings className="size-4" /> {t("E-postvarsler")}
          </Link>
        </div>

        <PendingInvites userId={user.id} />

        <div className="mt-8">
          <Tabs
            label={t("Filtrer varsler")}
            active={unreadOnly ? "uleste" : "alle"}
            items={[
              { key: "alle", label: t("Alle"), href: "/varsler" },
              { key: "uleste", label: t("Uleste"), href: "/varsler?vis=uleste" },
            ]}
          />
        </div>

        {notifications.length === 0 ? (
          <EmptyState className="mt-10" icon={<Bell className="size-5" />} title={unreadOnly ? t("Ingen uleste varsler") : t("Ingen varsler ennå")}>
            {t("Når noen kommenterer, reagerer, nevner deg, følger deg, vil komme i kontakt, svarer på en søknad eller vil hjelpe med et prosjekt, dukker det opp her.")}
          </EmptyState>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mt-8">
              <h2 className="caption">{t(group.label)}</h2>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                {group.items.map((n) => {
                  const { Icon, tone, text } = describe(n, t, locale);
                  return (
                    <li key={n.id}>
                      <Link href={href(n)} className={`relative flex gap-4 px-4 py-4 transition hover:bg-surface/70 md:px-5 ${n.unread ? "bg-sea/[0.06]" : ""}`}>
                        <span className="relative shrink-0">
                          <Avatar name={n.actor.name} image={n.actor.image} size={42} />
                          <span className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-surface ring-2 ring-ink ${tone}`}>
                            <Icon className="size-3" aria-hidden="true" />
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] leading-6 text-fg/85">
                            <b className="font-semibold text-fg">{actorName(n, t)}</b> {text}
                          </p>
                          {n.excerpt && <p className="mt-1 line-clamp-2 text-sm text-mist">«{n.excerpt}»</p>}
                          <p className="mt-1 text-xs text-mist/70" suppressHydrationWarning>
                            {timeAgo(n.createdAt, locale)}
                          </p>
                        </div>
                        {n.unread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-sea" aria-label={t("Ulest")} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
