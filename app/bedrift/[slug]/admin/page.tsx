import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, Lock, MousePointerClick, Plus } from "lucide-react";
import CheckoutButton from "@/app/priser/CheckoutButton";
import Avatar from "@/components/Avatar";
import { AddMember, AddToList, ContactCandidate, JobActions, NewTalentList, RemoveMember, TalentListTools } from "@/components/company/AdminTools";
import CompanyForm from "@/components/company/CompanyForm";
import { Webhooks } from "@/components/developers/DeveloperTools";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { getCompanyPlan, getDisplayPrices } from "@/lib/billing";
import { getCompanyBySlug, getMembership, listCompanyMembers } from "@/lib/companies";
import { FIELD_KEYS, FIELDS, OPEN_TO, OPEN_TO_LABELS, type FieldKey, type OpenTo } from "@/lib/constants";
import { listCompanyJobs } from "@/lib/jobs";
import { requireUser } from "@/lib/session";
import { getTalentList, listMembershipsFor, listTalentLists, searchCandidates } from "@/lib/talent";
import { listWebhooks, WEBHOOK_EVENTS } from "@/lib/webhooks";

export const metadata: Metadata = { title: "Administrer bedrift", robots: { index: false } };

const TABS = ["stillinger", "kandidater", "lister", "profil", "medlemmer", "utviklere", "abonnement"] as const;
type Tab = (typeof TABS)[number];
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fane?: string; q?: string; sted?: string; apen?: string; fag?: string; liste?: string; avbrutt?: string }>;
};

const ROLE_LABEL = { owner: "Eier", admin: "Administrator", member: "Medlem" } as const;

function Upsell({ companyId, price, canBuy }: { companyId: string; price: number; canBuy: boolean }) {
  return (
    <div className="rounded-[22px] glass-card p-6">
      <p className="flex items-center gap-2 font-semibold">
        <Lock className="size-4 text-mist" /> Krever Bedrift
      </p>
      <p className="mt-2 max-w-xl text-sm text-mist">
        Søk blant folk som har valgt å være synlige for bedrifter, lag lister med notater, eksporter til Excel og ta kontakt direkte. {price.toLocaleString("nb-NO")} kr i
        måneden, ingen bindingstid.
      </p>
      {canBuy && (
        <div className="mt-4">
          <CheckoutButton plan="business" companyId={companyId}>
            Start Bedrift
          </CheckoutButton>
        </div>
      )}
    </div>
  );
}

export default async function CompanyAdminPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const role = await getMembership(user.id, company.id);
  if (!role) notFound();

  const tab: Tab = (TABS as readonly string[]).includes(query.fane ?? "") ? (query.fane as Tab) : "stillinger";
  const canManage = role === "owner" || role === "admin";
  const [plan, prices] = await Promise.all([getCompanyPlan(company.id), getDisplayPrices()]);
  const business = plan.plan === "business";
  const base = `/bedrift/${company.slug}/admin`;

  const filters = {
    q: query.q?.slice(0, 100) ?? "",
    location: query.sted?.slice(0, 60) ?? null,
    openTo: OPEN_TO.includes(query.apen as OpenTo) ? (query.apen as OpenTo) : null,
    field: FIELD_KEYS.includes(query.fag as FieldKey) ? (query.fag as FieldKey) : null,
  };

  const [jobs, lists, candidates, list, members, hooks] = await Promise.all([
    tab === "stillinger" ? listCompanyJobs(company.id, { includeAll: true }) : [],
    tab === "kandidater" || tab === "lister" ? listTalentLists(user.id, company.id) : [],
    tab === "kandidater" && business ? searchCandidates(user.id, company.id, filters) : [],
    tab === "lister" && query.liste ? getTalentList(user.id, query.liste).catch(() => null) : null,
    tab === "medlemmer" ? listCompanyMembers(company.id) : [],
    tab === "utviklere" ? listWebhooks(user.id, company.id) : [],
  ]);
  const memberships = tab === "kandidater" ? await listMembershipsFor(company.id, candidates.map((c) => c.id)) : new Map<string, string[]>();

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <Link href={`/bedrift/${company.slug}`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {company.name}
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-bold tracking-tight">Administrer</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${business ? "bg-success/15 text-success" : "bg-fill text-mist"}`}>{business ? "Bedrift" : "Gratis"}</span>
        </div>

        <div className="mt-8">
          <Tabs
            label="Bedrift"
            active={tab}
            items={[
              { key: "stillinger", label: "Stillinger", href: base },
              { key: "kandidater", label: "Kandidater", href: `${base}?fane=kandidater` },
              { key: "lister", label: "Lister", href: `${base}?fane=lister` },
              { key: "profil", label: "Bedriftsprofil", href: `${base}?fane=profil` },
              { key: "medlemmer", label: "Medlemmer", href: `${base}?fane=medlemmer` },
              { key: "utviklere", label: "Webhooks", href: `${base}?fane=utviklere` },
              { key: "abonnement", label: "Abonnement", href: `${base}?fane=abonnement` },
            ]}
          />
        </div>

        <div className="mt-8">
          {tab === "stillinger" && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-mist">{business ? "Ubegrenset med stillinger." : "Gratis: én aktiv stilling om gangen."}</p>
                <ButtonLink href={`${base}/stilling/ny`} size="sm">
                  <Plus className="size-4" /> Ny stilling
                </ButtonLink>
              </div>
              {jobs.length === 0 ? (
                <EmptyState className="mt-6" title="Ingen stillinger ennå">
                  Legg ut den første. Den vises på bedriftssiden og under Stillinger.
                </EmptyState>
              ) : (
                <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <Link href={`${base}/stilling/${j.id}`} className="font-semibold hover:text-ice">
                          {j.title}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-mist">
                          <span className={j.status === "published" ? "text-success" : j.status === "draft" ? "text-warn" : ""}>
                            {j.status === "published" ? "Publisert" : j.status === "draft" ? "Utkast" : "Lukket"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Eye className="size-3.5" /> {j.views} visninger
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MousePointerClick className="size-3.5" /> {j.applyClicks} søknadsklikk
                          </span>
                        </p>
                      </div>
                      <JobActions jobId={j.id} status={j.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === "kandidater" &&
            (!business ? (
              <Upsell companyId={company.id} price={prices["business:month"].amount} canBuy={canManage} />
            ) : (
              <section>
                <form action={base} className="flex flex-wrap gap-2">
                  <input type="hidden" name="fane" value="kandidater" />
                  <input name="q" defaultValue={filters.q} placeholder="Ferdighet, rolle eller navn" aria-label="Søk" className="h-10 min-w-56 flex-1 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50" />
                  <input name="sted" defaultValue={filters.location ?? ""} placeholder="Sted" aria-label="Sted" className="h-10 w-36 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50" />
                  <select name="fag" defaultValue={filters.field ?? ""} aria-label="Fagfelt" className="h-10 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line">
                    <option value="">Alle fagfelt</option>
                    {FIELD_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {FIELDS[k].label}
                      </option>
                    ))}
                  </select>
                  <select name="apen" defaultValue={filters.openTo ?? ""} aria-label="Åpen for" className="h-10 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line">
                    <option value="">Åpen for alt</option>
                    {OPEN_TO.map((o) => (
                      <option key={o} value={o}>
                        {OPEN_TO_LABELS[o]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary">
                    Søk
                  </button>
                </form>
                {lists.length === 0 && (
                  <p className="mt-4 text-sm text-mist">
                    Tips: lag en liste under <Link href={`${base}?fane=lister`} className="text-ice hover:underline">Lister</Link> for å samle kandidater.
                  </p>
                )}
                {candidates.length === 0 ? (
                  <EmptyState className="mt-8" title="Ingen treff">
                    Bare folk som selv har slått på «Synlig for bedrifter» vises her.
                  </EmptyState>
                ) : (
                  <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                    {candidates.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <Avatar name={c.name} image={c.image} size={44} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/@${c.username}`} className="font-semibold hover:text-ice">
                            {c.name}
                          </Link>
                          <p className="text-sm text-mist">{[c.headline, c.location, `${c.projects} prosjekter`].filter(Boolean).join(" · ")}</p>
                          {c.skills.length > 0 && <p className="mt-1 truncate text-xs text-mist">{c.skills.slice(0, 8).join(" · ")}</p>}
                          {(c.openTo as OpenTo[]).length > 0 && (
                            <p className="mt-1 text-xs text-success">Åpen for {(c.openTo as OpenTo[]).map((o) => OPEN_TO_LABELS[o].toLowerCase()).join(", ")}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <AddToList userId={c.id} lists={lists} memberOf={memberships.get(c.id) ?? []} />
                          <ContactCandidate companyId={company.id} userId={c.id} name={c.name} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

          {tab === "lister" &&
            (!business && lists.length === 0 ? (
              <Upsell companyId={company.id} price={prices["business:month"].amount} canBuy={canManage} />
            ) : list ? (
              <section>
                <Link href={`${base}?fane=lister`} className="text-sm text-mist hover:text-fg">
                  ← Alle lister
                </Link>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">{list.name}</h2>
                  <div className="flex gap-2">
                    {business && (
                      <a href={`/api/bedrift/liste/${list.id}/csv`} className="inline-flex items-center gap-1.5 rounded-full glass-chip px-3 py-1.5 text-sm font-medium">
                        <Download className="size-4" /> Last ned (Excel/CSV)
                      </a>
                    )}
                    {canManage && <TalentListTools listId={list.id} />}
                  </div>
                </div>
                {list.members.length === 0 ? (
                  <p className="mt-6 text-mist">Listen er tom. Legg til folk fra Kandidater.</p>
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
            ) : (
              <section className="space-y-6">
                {business && <NewTalentList companyId={company.id} />}
                {lists.length === 0 ? (
                  <p className="text-mist">Ingen lister ennå.</p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                    {lists.map((l) => (
                      <li key={l.id}>
                        <Link href={`${base}?fane=lister&liste=${l.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-fill">
                          <span className="font-medium">{l.name}</span>
                          <span className="text-sm text-mist">{l.members} personer</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

          {tab === "profil" &&
            (canManage ? (
              <CompanyForm
                companyId={company.id}
                logoUrl={company.logoUrl}
                canDelete={role === "owner"}
                initial={{ name: company.name, website: company.website ?? "", location: company.location ?? "", size: company.size ?? "", about: company.about ?? "" }}
              />
            ) : (
              <p className="text-mist">Bare eier og administratorer kan endre bedriftsprofilen.</p>
            ))}

          {tab === "medlemmer" && (
            <section className="space-y-6">
              {canManage && <AddMember companyId={company.id} />}
              <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-4 px-5 py-3">
                    <Avatar name={m.name} image={m.image} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                        {m.name}
                      </Link>
                      <p className="text-sm text-mist">{ROLE_LABEL[m.role]}</p>
                    </div>
                    {canManage && m.role !== "owner" && <RemoveMember companyId={company.id} userId={m.userId} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "utviklere" &&
            (!business && hooks.length === 0 ? (
              <Upsell companyId={company.id} price={prices["business:month"].amount} canBuy={canManage} />
            ) : (
              <section className="space-y-4">
                <p className="max-w-2xl text-sm text-mist">
                  Vi sender en POST med JSON til adressen når noe skjer med stillingene deres, signert med <code className="font-mono">Vis-Signature</code>. Se{" "}
                  <Link href="/utviklere#webhooks" className="text-ice hover:underline">
                    dokumentasjonen
                  </Link>
                  .
                </p>
                <Webhooks companyId={company.id} hooks={hooks} events={WEBHOOK_EVENTS} canManage={canManage && business} />
              </section>
            ))}

          {tab === "abonnement" && (
            <section className="max-w-xl rounded-[22px] glass-card p-6">
              {query.avbrutt && <p className="mb-4 text-sm text-mist">Betalingen ble avbrutt. Ingenting er trukket.</p>}
              <p className="text-lg font-semibold">{business ? "Bedrift" : "Gratis"}</p>
              {plan.source === "stripe" && plan.renewsAt && (
                <p className="mt-1 text-sm text-mist">
                  {plan.cancelAtPeriodEnd ? "Avsluttes" : "Fornyes"} {plan.renewsAt.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
              {plan.source === "grant" && <p className="mt-1 text-sm text-mist">Gitt av Vis{plan.grantUntil ? ` til ${plan.grantUntil.toLocaleDateString("nb-NO")}` : ""}.</p>}
              {!business && (
                <p className="mt-2 text-sm text-mist">
                  {prices["business:month"].amount.toLocaleString("nb-NO")} kr i måneden: ubegrenset med stillinger, kandidatsøk, lister med eksport og direkte kontakt.
                </p>
              )}
              {canManage ? (
                <div className="mt-5">
                  {plan.source === "stripe" ? (
                    <CheckoutButton portal companyId={company.id} variant="secondary">
                      Administrer betaling og fakturaer
                    </CheckoutButton>
                  ) : !business ? (
                    <CheckoutButton plan="business" companyId={company.id}>
                      Start Bedrift
                    </CheckoutButton>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-mist">Bare eier og administratorer kan endre abonnementet.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
