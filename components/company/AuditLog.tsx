"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Download, History, Lock, ShieldCheck } from "lucide-react";
import { loadAuditAction } from "@/app/actions/company-privacy";
import Avatar from "@/components/Avatar";
import { useLocale, useT } from "@/components/LocaleProvider";
import { ROLE_TONE, STAGE_TONE } from "@/components/company/tones";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { AuditMeta } from "@/db/schema";
import { AUDIT_ACTION_LABELS, AUDIT_GROUP_LABELS, AUDIT_GROUPS, ROLE_LABEL, type AuditAction, type AuditGroup } from "@/lib/company-labels";
import type { CompanyRole } from "@/lib/company-permissions";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants";
import { dateLocale, type T } from "@/lib/i18n";

const EASE = [0.16, 1, 0.3, 1] as const;
const PAGE = 50;
const ZONE = "Europe/Oslo";

export type AuditItem = {
  id: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  label: string | null;
  meta: AuditMeta;
  createdAt: string;
  actor: { id: string; name: string; username: string; image: string | null } | null;
  subject: { id: string; name: string; username: string } | null;
};

const GROUP_OF = Object.fromEntries(
  (Object.keys(AUDIT_GROUPS) as AuditGroup[]).flatMap((g) => AUDIT_GROUPS[g].map((a) => [a, g])),
) as Partial<Record<AuditAction, AuditGroup>>;

// Prikken på avataren: hva slags handling. Sletting og fjerning er røde.
const DANGER = new Set<AuditAction>(["member.removed", "employee.removed", "invite.revoked", "job.deleted", "list.deleted", "webhook.deleted", "retention.purged", "interview.cancelled"]);
const GROUP_DOT: Record<AuditGroup, string> = { tilgang: "bg-sea", sokere: "bg-success", eksport: "bg-warn", innstillinger: "bg-mist" };
const dotOf = (action: AuditAction) => (DANGER.has(action) ? "bg-danger" : GROUP_DOT[GROUP_OF[action] as AuditGroup] ?? "bg-sea");

const isRole = (v: unknown): v is CompanyRole => typeof v === "string" && Object.hasOwn(ROLE_LABEL, v);
const isStatus = (v: unknown): v is ApplicationStatus => typeof v === "string" && Object.hasOwn(APPLICATION_STATUS_LABELS, v);

// Små merker for det som står i meta (bare id-er, tall, statuser og ja/nei).
function metaChips(meta: AuditMeta, t: T) {
  const chips: { key: string; text: string; tone: string }[] = [];
  const pill = (v: unknown) =>
    isRole(v) ? { text: t(ROLE_LABEL[v]), tone: ROLE_TONE[v] } : isStatus(v) ? { text: t(APPLICATION_STATUS_LABELS[v]), tone: STAGE_TONE[v] } : null;
  const from = pill(meta.from);
  const to = pill(meta.to ?? meta.status ?? meta.role);
  if (from && to) chips.push({ key: "move", text: `${from.text} → ${to.text}`, tone: to.tone });
  else if (to) chips.push({ key: "to", ...to });
  if (typeof meta.rows === "number") chips.push({ key: "rows", text: t("{n} rader", { n: meta.rows }), tone: "bg-fill text-mist" });
  if (typeof meta.n === "number") chips.push({ key: "n", text: t("{n} stk", { n: meta.n }), tone: "bg-fill text-mist" });
  if (typeof meta.retentionMonths === "number") chips.push({ key: "ret", text: t("{n} mnd", { n: meta.retentionMonths }), tone: "tone tone-sea" });
  if (meta.notes === true) chips.push({ key: "notes", text: t("med notater"), tone: "tone tone-warn" });
  if (typeof meta.personal === "boolean") chips.push({ key: "personal", text: meta.personal ? t("med persondata") : t("uten persondata"), tone: meta.personal ? "tone tone-warn" : "bg-fill text-mist" });
  if (typeof meta.active === "boolean") chips.push({ key: "active", text: meta.active ? t("slått på") : t("slått av"), tone: meta.active ? "tone tone-success" : "bg-fill text-mist" });
  if (meta.ok === false) chips.push({ key: "ok", text: t("feilet"), tone: "tone tone-danger" });
  if (typeof meta.version === "string") chips.push({ key: "version", text: t("versjon {v}", { v: meta.version }), tone: "bg-fill text-mist" });
  return chips;
}

const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(iso));
// I dag og i går (Oslo-tid), til overskriftene over hver dag.
const recentDays = () => [dayKey(new Date().toISOString()), dayKey(new Date(Date.now() - 86_400_000).toISOString())] as const;

export function AuditLog({
  companyId,
  base,
  initial,
  group,
  business,
  canExport,
}: {
  companyId: string;
  base: string;
  initial: AuditItem[];
  group: AuditGroup | null;
  business: boolean;
  canExport: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const reduce = useReduceMotion();
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < PAGE);
  const [pending, start] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const more = () =>
    start(async () => {
      const last = items.at(-1);
      const result = await loadAuditAction(companyId, { group, before: last?.createdAt ?? null });
      if (!result.ok) return void toast.error(result.error);
      const fresh = result.data.filter((r) => !items.some((i) => i.id === r.id));
      setItems((l) => [...l, ...fresh]);
      if (result.data.length < PAGE) setDone(true);
    });

  // Lastes ned med fetch, så en grense eller manglende tilgang vises som en melding.
  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/bedrift/${companyId}/logg${group ? `?logg=${group}` : ""}`);
      if (!res.ok) return void toast.error((await res.text()) || t("Noe gikk galt."));
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `aktivitetslogg-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Loggen er lastet ned", { description: "Nedlastingen er også logget." });
    } catch {
      toast.error(t("Noe gikk galt."));
    } finally {
      setDownloading(false);
    }
  };

  const [today, yesterday] = recentDays();
  const dayLabel = (key: string, iso: string) =>
    key === today
      ? t("I dag")
      : key === yesterday
        ? t("I går")
        : new Date(iso).toLocaleDateString(dateLocale(locale), { timeZone: ZONE, weekday: "long", day: "numeric", month: "long" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(locale), { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });

  const days: { key: string; label: string; rows: AuditItem[] }[] = [];
  for (const row of items) {
    const key = dayKey(row.createdAt);
    const last = days.at(-1);
    if (last?.key === key) last.rows.push(row);
    else days.push({ key, label: dayLabel(key, row.createdAt), rows: [row] });
  }

  const chip = (key: AuditGroup | null, label: string) => {
    const on = group === key;
    return (
      <Link
        key={key ?? "alle"}
        href={`${base}?fane=personvern${key ? `&logg=${key}` : ""}`}
        scroll={false}
        aria-current={on ? "true" : undefined}
        className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${on ? "bg-primary text-on-primary" : "glass-chip text-fg/85 hover:text-fg"}`}
      >
        {label}
      </Link>
    );
  };

  let index = 0;
  return (
    <div id="logg" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("Filtrer loggen")} className="flex flex-wrap gap-2">
          {chip(null, t("Alle"))}
          {(Object.keys(AUDIT_GROUP_LABELS) as AuditGroup[]).map((g) => chip(g, t(AUDIT_GROUP_LABELS[g])))}
        </nav>
        {canExport &&
          (business ? (
            <Button size="sm" variant="secondary" loading={downloading} onClick={download}>
              <Download className="size-4" /> {t("Last ned CSV")}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-xs font-medium text-mist">
              <Lock className="size-3.5" /> {t("CSV med Bedrift")}
            </span>
          ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-[22px] glass-card px-6 py-12 text-center">
          <span className="glass-chip flex size-12 items-center justify-center rounded-full text-mist">
            <History className="size-5" />
          </span>
          <p className="mt-4 font-semibold">{group ? t("Ingenting i denne kategorien ennå") : t("Ingen aktivitet ennå")}</p>
          <p className="mt-1 max-w-sm text-sm text-mist">{t("Når noen åpner en søknad, flytter en søker, inviterer eller eksporterer, står det her.")}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {days.map((day) => (
            <section key={day.key} aria-label={day.label}>
              <h3 className="caption flex items-center gap-2 px-1">
                <span className="first-letter:uppercase">{day.label}</span>
                <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold tabular-nums text-mist">{day.rows.length}</span>
              </h3>
              <ul className="mt-1.5 rounded-[22px] glass-card p-2">
                {day.rows.map((row) => {
                  const chips = metaChips(row.meta, t);
                  const delay = reduce ? 0 : Math.min(index++, 12) * 0.03;
                  const target =
                    row.targetType === "list" && row.targetId && row.action !== "list.deleted"
                      ? `${base}?fane=lister&liste=${row.targetId}`
                      : row.targetType === "job" && row.targetId && row.action !== "job.deleted"
                        ? `${base}/stilling/${row.targetId}`
                        : null;
                  return (
                    <motion.li
                      key={row.id}
                      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE, delay }}
                      className="flex items-start gap-3 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-fill"
                    >
                      <span className="relative mt-0.5 shrink-0">
                        {row.actor ? (
                          <Avatar name={row.actor.name} image={row.actor.image} size={32} />
                        ) : (
                          <span className="flex size-8 items-center justify-center rounded-full bg-fill text-mist" title={t("Automatisk")}>
                            <ShieldCheck className="size-4" />
                          </span>
                        )}
                        <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-ink ${dotOf(row.action)}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6">
                          {row.actor ? (
                            <Link href={`/@${row.actor.username}`} className="font-medium text-fg hover:text-ice">
                              {row.actor.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-fg">Vis</span>
                          )}{" "}
                          <span className="text-mist">{t(AUDIT_ACTION_LABELS[row.action] ?? row.action)}</span>
                          {row.subject && (
                            <>
                              {" · "}
                              <Link href={`/@${row.subject.username}`} className="text-ice hover:underline">
                                {row.subject.name}
                              </Link>
                            </>
                          )}
                        </p>
                        {(row.label || chips.length > 0) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {row.label &&
                              (target ? (
                                <Link href={target} className="glass-chip max-w-60 truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-fg/85 hover:text-fg">
                                  {row.label}
                                </Link>
                              ) : (
                                <span className="glass-chip max-w-60 truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-fg/85">{row.label}</span>
                              ))}
                            {chips.map((c) => (
                              <span key={c.key} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.tone}`}>
                                {c.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <time dateTime={row.createdAt} className="mt-1 shrink-0 text-xs tabular-nums text-mist">
                        {time(row.createdAt)}
                      </time>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-mist">
            {business ? (
              t("Loggen viser de siste 24 månedene.")
            ) : (
              <>
                <Lock className="size-3.5" /> {t("Uten Bedrift ser dere de siste 30 dagene.")}
                <Link href={`${base}?fane=abonnement`} className="text-ice hover:underline">
                  {t("Se Bedrift")}
                </Link>
              </>
            )}
          </p>
          {!done && (
            <Button size="sm" variant="ghost" loading={pending} onClick={more}>
              {t("Vis flere")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
