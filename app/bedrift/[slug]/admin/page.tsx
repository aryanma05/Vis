import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import AdminHero from "@/components/company/AdminHero";
import TwoFactorGate from "@/components/company/TwoFactorGate";
import { Tabs } from "@/components/ui/tabs";
import { getCompanyPlan, getDisplayPrices } from "@/lib/billing";
import { getCompanyBySlug } from "@/lib/companies";
import { getCompanyGate } from "@/lib/company-access";
import { ADMIN_TAB_LABELS } from "@/lib/company-labels";
import { can } from "@/lib/company-permissions";
import { getAdminBadges } from "@/lib/company-stats";
import type { Locale } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import AbonnementTab from "./_tabs/abonnement";
import { ADMIN_TABS, TAB_ACTION, type AdminCtx, type AdminQuery, type AdminTab } from "./_tabs/context";
import KandidaterTab from "./_tabs/kandidater";
import ListerTab from "./_tabs/lister";
import MedlemmerTab from "./_tabs/medlemmer";
import OversiktTab from "./_tabs/oversikt";
import PersonvernTab from "./_tabs/personvern";
import ProfilTab from "./_tabs/profil";
import SokereTab from "./_tabs/sokere";
import StillingerTab from "./_tabs/stillinger";
import UtfordringerTab from "./_tabs/utfordringer";
import UtviklereTab from "./_tabs/utviklere";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Administrer bedrift"), robots: { index: false } };
}

// «1 990 kr» / «NOK 1,990»
const formatPrice = (amount: number, locale: Locale) =>
  locale === "en" ? `NOK ${amount.toLocaleString("en-GB")}` : `${amount.toLocaleString("nb-NO")} kr`;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<AdminQuery> };

const TAB_COMPONENTS: Record<AdminTab, (props: { ctx: AdminCtx }) => Promise<ReactNode>> = {
  oversikt: OversiktTab,
  stillinger: StillingerTab,
  sokere: SokereTab,
  kandidater: KandidaterTab,
  lister: ListerTab,
  utfordringer: UtfordringerTab,
  profil: ProfilTab,
  medlemmer: MedlemmerTab,
  personvern: PersonvernTab,
  utviklere: UtviklereTab,
  abonnement: AbonnementTab,
};

// Skallet i administrasjonen: tilgang, toppen, fanene rollen har tilgang til, og fanen som er valgt.
// Hver fane ligger i _tabs/ og henter sine egne data.
export default async function CompanyAdminPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const [{ slug }, query, t, locale] = await Promise.all([params, searchParams, getT(), getLocale()]);
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const gate = await getCompanyGate(user.id, company.id);
  if (!gate) notFound();
  const { role } = gate;

  const tabs = ADMIN_TABS.filter((key) => can(role, TAB_ACTION[key]));
  const tab: AdminTab = (tabs as string[]).includes(query.fane ?? "") ? (query.fane as AdminTab) : "oversikt";
  const [plan, prices, badges] = await Promise.all([getCompanyPlan(company.id), getDisplayPrices(), getAdminBadges(company.id)]);
  const business = plan.plan === "business";
  const base = `/bedrift/${company.slug}/admin`;
  const ctx: AdminCtx = {
    user,
    company,
    role,
    plan,
    business,
    base,
    monthly: formatPrice(prices["business:month"].amount, locale),
    canBuy: can(role, "company.billing"),
    t,
    locale,
    query,
  };
  const count = (key: AdminTab) => {
    if (key === "sokere") return badges.freshApplicants || null;
    if (key === "medlemmer" && can(role, "members.invite")) return badges.pendingInvites || null;
    return null;
  };
  const Tab = TAB_COMPONENTS[tab];

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <Link href={`/bedrift/${company.slug}`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {company.name}
        </Link>
        <AdminHero company={company} role={role} business={business} base={base} badges={badges} t={t} />

        <div className="mt-8">
          <Tabs
            label={t("Bedrift")}
            active={tab}
            items={tabs.map((key) => ({ key, label: t(ADMIN_TAB_LABELS[key]), href: key === "oversikt" ? base : `${base}?fane=${key}`, count: count(key) }))}
          />
        </div>

        <div className="mt-8">{gate.needs2fa && tab !== "medlemmer" ? <TwoFactorGate /> : <Tab ctx={ctx} />}</div>
      </div>
    </main>
  );
}
