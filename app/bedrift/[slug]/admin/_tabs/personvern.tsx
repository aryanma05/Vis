import Link from "next/link";
import { Archive, ChevronRight, Clock, FileSignature, History, KeyRound, Server, ShieldCheck, Trash2, Webhook } from "lucide-react";
import { AuditLog } from "@/components/company/AuditLog";
import { RetentionPicker, TermsCard } from "@/components/company/PrivacyPanel";
import { Section } from "@/components/ui/field";
import { listAudit } from "@/lib/audit";
import { AUDIT_GROUPS, type AuditGroup } from "@/lib/company-labels";
import { can } from "@/lib/company-permissions";
import { getPrivacyStatus } from "@/lib/company-privacy";
import type { AdminCtx } from "./context";

// Det som lagres, hvor lenge (samme regler som lib/retention.ts og /personvern).
const KEEP = [
  { what: "Søknader", how: "Senest 12 måneder etter søknaden, tidligere når stillingen lukkes" },
  { what: "Trukne søknader", how: "Minimert med en gang, slettet etter 30 dager" },
  { what: "Kandidatlister", how: "12 måneder, eller med en gang kandidaten skjuler seg" },
  { what: "Kontaktforespørsler", how: "24 måneder" },
  { what: "Aktivitetsloggen", how: "24 måneder" },
];

// «Personvern og logg» (eier og administratorer): databehandleravtalen, lagringstid, tilgang og
// aktivitetsloggen. Alle tall kommer fra getPrivacyStatus, som sjekker tilgangen selv.
export default async function PersonvernTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, base, t, query } = ctx;
  const group = query.logg && Object.hasOwn(AUDIT_GROUPS, query.logg) ? (query.logg as AuditGroup) : null;
  const [status, rows] = await Promise.all([getPrivacyStatus(user.id, company.id), listAudit(user.id, company.id, { scope: "full", group })]);
  const { terms, retention, applications, members } = status;
  const twoFactorShare = members.total ? Math.round((members.twoFactor / members.total) * 100) : 0;

  const tiles = [
    {
      icon: <FileSignature className="size-4" />,
      label: t("Databehandleravtale"),
      value: terms.upToDate ? t("Godtatt") : t("Mangler"),
      hint: terms.upToDate ? t("Versjon {version}", { version: terms.current }) : t("Kreves for publisering og kandidatsøk"),
      tone: terms.upToDate ? "bg-success/15 text-success" : "bg-warn/15 text-warn",
      valueTone: terms.upToDate ? "text-success" : "text-warn",
    },
    {
      icon: <Clock className="size-4" />,
      label: t("Lagringstid"),
      value: t("{n} mnd", { n: retention.effective }),
      hint: t("etter at stillingen er lukket"),
      tone: "bg-sea/15 text-sea",
      valueTone: "",
    },
    {
      icon: <Archive className="size-4" />,
      label: t("Søknader lagret"),
      value: String(applications.stored),
      hint: applications.soon ? t("{n} slettes innen 30 dager", { n: applications.soon }) : t("Ingen slettes de neste 30 dagene"),
      tone: "bg-fill text-mist",
      valueTone: "",
    },
    {
      icon: <Trash2 className="size-4" />,
      label: t("Slettet automatisk"),
      value: String(status.purged30),
      hint: t("siste 30 dager"),
      tone: "bg-fill text-mist",
      valueTone: "",
    },
  ];

  const access = [
    {
      icon: <KeyRound className="size-4" />,
      label: t("Tofaktor"),
      text: members.required ? t("{n} av {total} har det, og bedriften krever det", { n: members.twoFactor, total: members.total }) : t("{n} av {total} har slått det på", { n: members.twoFactor, total: members.total }),
      meter: twoFactorShare,
      href: `${base}?fane=medlemmer`,
    },
    {
      icon: <Webhook className="size-4" />,
      label: t("Webhooks med persondata"),
      text: status.webhooks.total ? t("{n} av {total} sender kandidatens navn og melding", { n: status.webhooks.personal, total: status.webhooks.total }) : t("Ingen webhooks"),
      meter: null,
      href: `${base}?fane=utviklere`,
    },
    {
      icon: <History className="size-4" />,
      label: t("Eksporter"),
      text: t("{n} nedlastinger siste 30 dager", { n: status.exports30 }),
      meter: null,
      href: `${base}?fane=personvern&logg=eksport`,
    },
  ];

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <li key={tile.label} className="fade-up rounded-[22px] glass-card p-4 md:p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2 text-sm text-mist">
              <span className={`flex size-7 items-center justify-center rounded-[10px] ${tile.tone}`}>{tile.icon}</span>
              <span className="truncate">{tile.label}</span>
            </div>
            <p className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${tile.valueTone}`}>{tile.value}</p>
            <p className="mt-0.5 truncate text-xs text-mist">{tile.hint}</p>
          </li>
        ))}
      </ul>

      <div className="fade-up mt-2" style={{ animationDelay: "240ms" }}>
        <Section icon={<FileSignature />} title={t("Databehandleravtale")} description={t("Bedriften er behandlingsansvarlig for kandidatdataene, og Vis er databehandler. Avtalen beskriver hvordan.")}>
          <TermsCard
            companyId={company.id}
            companyName={company.name}
            acceptedAt={terms.acceptedAt ? terms.acceptedAt.toISOString() : null}
            acceptedBy={terms.acceptedBy}
            version={terms.version}
            current={terms.current}
          />
        </Section>

        <Section icon={<Clock />} title={t("Lagringstid")} description={t("Hvor lenge søknader beholdes etter at stillingen er lukket. Alt slettes automatisk hver natt.")}>
          {can(role, "company.privacy") && <RetentionPicker companyId={company.id} months={retention.months} business={business} base={base} />}
          <dl className="mt-5 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {KEEP.map((k) => (
              <div key={k.what} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 px-5 py-3 text-sm">
                <dt className="font-medium">{t(k.what)}</dt>
                <dd className="text-mist">{t(k.how)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13px] text-mist">
            {t("Slettet automatisk siste 30 dager: {n}", { n: status.purged30 })}
            {applications.withdrawn > 0 && ` · ${t("{n} trukne søknader venter på sletting", { n: applications.withdrawn })}`}
          </p>
        </Section>

        <Section icon={<ShieldCheck />} title={t("Tilgang")} description={t("Gi tilgang bare til dem som trenger det, og fjern den når folk slutter.")}>
          <ul className="rounded-[22px] glass-card p-2">
            {access.map((a) => (
              <li key={a.label}>
                <Link href={a.href} scroll={false} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-fill">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-fill text-mist">{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block truncate text-xs text-mist">{a.text}</span>
                    {a.meter !== null && (
                      <span className="mt-1.5 block h-1.5 max-w-48 overflow-hidden rounded-full bg-fill" role="meter" aria-valuenow={a.meter} aria-valuemin={0} aria-valuemax={100} aria-label={a.label}>
                        <span className={`block h-full rounded-full ${a.meter === 100 ? "bg-success" : "bg-sea"}`} style={{ width: `${a.meter}%` }} />
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-mist" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="aktivitetslogg"
          icon={<History />}
          title={t("Aktivitetslogg")}
          description={
            business
              ? t("Hvem gjorde hva, og med hvem sine data. 24 måneder, og kan lastes ned.")
              : t("Hvem gjorde hva, og med hvem sine data. Siste 30 dager; Bedrift gir 24 måneder og CSV.")
          }
        >
          <AuditLog
            key={group ?? "alle"}
            companyId={company.id}
            base={base}
            group={group}
            business={business}
            canExport={can(role, "audit.export")}
            initial={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
          />
        </Section>

        <Section icon={<Server />} title={t("Underleverandører")} description={t("Hvem som hjelper Vis med drift, database, e-post og betaling.")}>
          <p className="max-w-xl text-sm leading-6 text-mist">
            {t("Listen over underleverandører står i personvernerklæringen. Vi varsler før vi bytter, så dere kan protestere.")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/personvern" className="glass-chip rounded-full px-3.5 py-1.5 text-sm font-medium hover:text-ice">
              {t("Personvernerklæringen")}
            </Link>
            <Link href="/vilkar/databehandleravtale" className="glass-chip rounded-full px-3.5 py-1.5 text-sm font-medium hover:text-ice">
              {t("Databehandleravtalen")}
            </Link>
            <Link href="/vilkar#bedrifter" className="glass-chip rounded-full px-3.5 py-1.5 text-sm font-medium hover:text-ice">
              {t("Regler for bedrifter")}
            </Link>
          </div>
        </Section>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-mist">
        <ShieldCheck className="size-3.5 text-success" /> {t("Bare eier og administratorer ser denne siden. Alle eksporter og endringer logges.")}
      </p>
    </div>
  );
}
