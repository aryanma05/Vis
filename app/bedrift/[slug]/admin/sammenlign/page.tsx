import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Columns3, Lock } from "lucide-react";
import Avatar from "@/components/Avatar";
import { UsedTech } from "@/components/company/Applicants";
import { EmptyState } from "@/components/ui/misc";
import { hasBusiness } from "@/lib/billing";
import { getCompanyBySlug, getMembership } from "@/lib/companies";
import { APPLICATION_STATUS_LABELS, OPEN_TO_LABELS } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { compareCandidates } from "@/lib/talent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Sammenlign kandidater"), robots: { index: false } };
}

function Row<T extends { id: string }>({ label, people, children }: { label: string; people: T[]; children: (p: T) => ReactNode }) {
  return (
    <tr className="border-t border-line align-top">
      <th scope="row" className="sticky left-0 z-10 w-36 bg-ink/90 py-4 pr-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-mist backdrop-blur">
        {label}
      </th>
      {people.map((p) => (
        <td key={p.id} className="min-w-56 px-3 py-4 text-sm">
          {children(p)}
        </td>
      ))}
    </tr>
  );
}

// Kandidatene side om side, rad for rad: hva de har laget, hva de faktisk har brukt,
// erfaring, utdanning og søknaden. Alle står i samme format, uansett hvordan CV-en ser ut.
export default async function ComparePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ folk?: string }> }) {
  const user = await requireUser();
  const [{ slug }, { folk = "" }, t] = await Promise.all([params, searchParams, getT()]);
  const company = await getCompanyBySlug(slug);
  if (!company || !(await getMembership(user.id, company.id))) notFound();
  const base = `/bedrift/${company.slug}/admin`;
  const business = await hasBusiness(company.id);
  const people = business ? await compareCandidates(user.id, company.id, folk.split(",").filter(Boolean)) : [];

  const none = <span className="text-mist/60">–</span>;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <Link href={`${base}?fane=sokere`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Søkere")}
        </Link>
        <h1 className="mt-4 flex items-center gap-3 text-4xl font-bold tracking-tight">
          <Columns3 className="size-8 text-mist" /> {t("Sammenlign")}
        </h1>

        {!business ? (
          <EmptyState className="mt-8" icon={<Lock className="size-5" />} title={t("Krever Bedrift")}>
            {t("Sammenlign opptil fire kandidater side om side: prosjekter, teknologier de faktisk har brukt, erfaring og søknad.")}
          </EmptyState>
        ) : people.length === 0 ? (
          <EmptyState className="mt-8" title={t("Velg kandidater å sammenligne")}>
            {t("Huk av «Sammenlign» på opptil fire kort under Søkere eller Kandidatsøk.")}
          </EmptyState>
        ) : (
          <div className="-mx-5 mt-8 overflow-x-auto px-5 md:mx-0 md:px-0">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <td className="sticky left-0 z-10 bg-ink/90 backdrop-blur" />
                  {people.map((p) => (
                    <th key={p.id} scope="col" className="min-w-56 px-3 pb-4 text-left align-bottom font-normal">
                      <Avatar name={p.name} image={p.image} size={56} />
                      <Link href={`/@${p.username}`} target="_blank" className="mt-3 block text-lg font-semibold hover:text-ice">
                        {p.name}
                      </Link>
                      <p className="text-sm text-mist">{p.headline ?? `@${p.username}`}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label={t("Søknad")} people={people}>
                  {(p) =>
                    p.application ? (
                      <div>
                        <p>
                          {p.application.jobTitle} ·{" "}
                          <Link href={`${base}/soker/${p.application.id}`} className="font-medium text-ice hover:underline">
                            {t(APPLICATION_STATUS_LABELS[p.application.status])}
                          </Link>
                        </p>
                        {p.application.message && <p className="mt-1 line-clamp-4 text-mist">«{p.application.message}»</p>}
                      </div>
                    ) : (
                      <span className="text-mist">{t("Fra kandidatsøket")}</span>
                    )
                  }
                </Row>
                <Row label={t("Prosjekter")} people={people}>
                  {(p) => (
                    <div>
                      <p className="mb-2 text-mist">{t("{n} publiserte", { n: p.projects })}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {p.showcase.map((s) => (
                          <Link key={s.id} href={`/prosjekt/${s.id}`} target="_blank" title={s.title} className="block aspect-[4/3] overflow-hidden rounded-lg bg-fill-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {s.cover && <img src={s.cover} alt={s.title} className="size-full object-cover" />}
                          </Link>
                        ))}
                      </div>
                      {p.showcase.some((s) => s.role) && (
                        <ul className="mt-2 space-y-0.5 text-xs text-mist">
                          {p.showcase
                            .filter((s) => s.role)
                            .map((s) => (
                              <li key={s.id} className="truncate">
                                {s.title}: <span className="text-fg/80">{s.role}</span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Row>
                <Row label={t("Brukt i prosjekter")} people={people}>{(p) => (p.usedTech.length ? <UsedTech tech={p.usedTech} max={8} /> : none)}</Row>
                <Row label={t("Ferdigheter (CV)")} people={people}>{(p) => (p.skills.length ? <span className="text-mist">{p.skills.slice(0, 10).join(" · ")}</span> : none)}</Row>
                <Row label={t("Erfaring")} people={people}>
                  {(p) =>
                    p.experience.length ? (
                      <ul className="space-y-2">
                        {p.experience.map((e, i) => (
                          <li key={i}>
                            <p className="font-medium">{e.title}</p>
                            <p className="text-xs text-mist">
                              {e.organization} · {[e.startDate, e.endDate ?? t("nå")].filter(Boolean).join(" – ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      none
                    )
                  }
                </Row>
                <Row label={t("Utdanning")} people={people}>
                  {(p) =>
                    p.education.length || p.studyProgram ? (
                      <ul className="space-y-2">
                        {p.studyProgram && (
                          <li>
                            <p className="font-medium">{p.studyProgram}</p>
                            {p.graduationYear && <p className="text-xs text-mist">{t("Ferdig {year}", { year: p.graduationYear })}</p>}
                          </li>
                        )}
                        {p.education.map((e, i) => (
                          <li key={i}>
                            <p className="font-medium">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || e.institution}</p>
                            <p className="text-xs text-mist">
                              {e.institution}
                              {e.endDate ? ` · ${e.endDate}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      none
                    )
                  }
                </Row>
                <Row label={t("Sted")} people={people}>{(p) => p.location ?? none}</Row>
                <Row label={t("Åpen for")} people={people}>{(p) => (p.openTo.length ? <span className="text-success">{p.openTo.map((o) => t(OPEN_TO_LABELS[o])).join(", ")}</span> : none)}</Row>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
