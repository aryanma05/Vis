import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, Mail, MapPin } from "lucide-react";
import Avatar from "@/components/Avatar";
import { ApplicantNote, StageButtons, UsedTech } from "@/components/company/Applicants";
import { EmptyState } from "@/components/ui/misc";
import { getApplicationForCompany } from "@/lib/applications";
import { hasBusiness } from "@/lib/billing";
import { getCompanyBySlug, getMembership } from "@/lib/companies";
import { APPLICATION_STATUS_LABELS, OPEN_TO_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { T } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { loadShowcase } from "@/lib/talent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Søker"), robots: { index: false } };
}

const period = (start: string | null, end: string | null, t: T) => [start, end ?? t("nå")].filter(Boolean).join(" – ");

// Én søker: profilen, prosjektene de valgte, teknologiene de faktisk har brukt, CV-en i
// kortform, meldingen og et internt notat. Status flyttes øverst.
export default async function ApplicantPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const user = await requireUser();
  const [{ slug, id }, t, locale] = await Promise.all([params, getT(), getLocale()]);
  const company = await getCompanyBySlug(slug);
  if (!company || !(await getMembership(user.id, company.id))) notFound();
  const application = await getApplicationForCompany(user.id, id).catch(() => null);
  if (!application || application.companyId !== company.id) notFound();
  const [business, showcase] = await Promise.all([hasBusiness(company.id), loadShowcase([application.candidate.id], 6)]);
  const base = `/bedrift/${company.slug}/admin`;
  const c = application.candidate;
  const highlighted = new Set(application.highlights.map((h) => h.id));
  const more = (showcase.get(c.id) ?? []).filter((p) => !highlighted.has(p.id));
  const student = [c.studyProgram, c.graduationYear ? t("ferdig {year}", { year: c.graduationYear }) : null].filter(Boolean).join(", ");

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <Link href={`${base}?fane=sokere&stilling=${application.job.id}`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Søkere til {job}", { job: application.job.title })}
        </Link>

        <header className="mt-6 flex flex-wrap items-start gap-5">
          <Avatar name={c.name} image={c.image} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{c.name}</h1>
            {c.headline && <p className="mt-1 text-lg text-fg/80">{c.headline}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mist">
              {c.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {c.location}
                </span>
              )}
              {student && <span>{t("Student: {details}", { details: student })}</span>}
              <span suppressHydrationWarning>{t("Søkte {time}", { time: timeAgo(application.createdAt, locale) })}</span>
            </p>
            <p className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link href={`/@${c.username}`} target="_blank" className="inline-flex items-center gap-1 rounded-full glass-chip px-3 py-1.5 font-medium hover:bg-fill-2">
                {t("Profil")} <ArrowUpRight className="size-3.5" />
              </Link>
              <Link href={`/@${c.username}/cv`} target="_blank" className="inline-flex items-center gap-1 rounded-full glass-chip px-3 py-1.5 font-medium hover:bg-fill-2">
                <FileText className="size-3.5" /> {t("CV")}
              </Link>
              <a href={`mailto:${c.email}?subject=${encodeURIComponent(application.job.title)}`} className="inline-flex items-center gap-1 rounded-full glass-chip px-3 py-1.5 font-medium hover:bg-fill-2">
                <Mail className="size-3.5" /> {c.email}
              </a>
            </p>
          </div>
        </header>

        <section className="mt-8 rounded-[22px] glass-card p-5">
          <h2 className="caption">{t("Status")}</h2>
          <div className="mt-3">
            {business ? (
              <StageButtons id={application.id} status={application.status} name={c.name} />
            ) : (
              <p className="text-sm text-mist">
                {t(APPLICATION_STATUS_LABELS[application.status])}.{" "}
                <Link href={`${base}?fane=abonnement`} className="text-ice hover:underline">
                  {t("Med Bedrift")}
                </Link>{" "}
                {t("kan dere flytte søkeren til intervju, tilbud eller avslag, og kandidaten får beskjed automatisk.")}
              </p>
            )}
          </div>
        </section>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-10">
            {application.message && (
              <section>
                <h2 className="caption">{t("Melding")}</h2>
                <blockquote className="mt-3 whitespace-pre-line rounded-[22px] bg-fill p-5 leading-7 text-fg/90">{application.message}</blockquote>
              </section>
            )}

            <section>
              <h2 className="caption">{t("Prosjektene {name} valgte", { name: c.name.split(" ")[0] })}</h2>
              {application.highlights.length === 0 ? (
                <EmptyState className="mt-3" title={t("Ingen prosjekter valgt")}>
                  {t("Se alle prosjektene på profilen.")}
                </EmptyState>
              ) : (
                <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                  {application.highlights.map((p) => (
                    <li key={p.id}>
                      <Link href={`/prosjekt/${p.id}`} target="_blank" className="group block overflow-hidden rounded-[22px] glass-card transition hover:bg-card-hover">
                        <span className="block aspect-[16/10] overflow-hidden bg-fill-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.cover && <img src={p.cover} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.02]" />}
                        </span>
                        <span className="block p-4">
                          <span className="block font-semibold">{p.title}</span>
                          {p.role && <span className="mt-0.5 block text-sm text-ice">{t("Rolle: {role}", { role: p.role })}</span>}
                          {p.summary && <span className="mt-1 line-clamp-2 block text-sm text-mist">{p.summary}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {more.length > 0 && (
              <section>
                <h2 className="caption">{t("Flere prosjekter")}</h2>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {more.map((p) => (
                    <li key={p.id}>
                      <Link href={`/prosjekt/${p.id}`} target="_blank" className="block overflow-hidden rounded-2xl glass-card hover:bg-card-hover">
                        <span className="block aspect-[4/3] bg-fill-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.cover && <img src={p.cover} alt="" className="size-full object-cover" />}
                        </span>
                        <span className="block truncate px-3 py-2 text-sm font-medium">{p.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(application.experience.length > 0 || application.education.length > 0) && (
              <section className="grid gap-8 sm:grid-cols-2">
                {application.experience.length > 0 && (
                  <div>
                    <h2 className="caption">{t("Erfaring")}</h2>
                    <ul className="mt-3 space-y-3 text-sm">
                      {application.experience.map((e, i) => (
                        <li key={i}>
                          <p className="font-medium">{e.title}</p>
                          <p className="text-mist">
                            {e.organization} · {period(e.startDate, e.endDate, t)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {application.education.length > 0 && (
                  <div>
                    <h2 className="caption">{t("Utdanning")}</h2>
                    <ul className="mt-3 space-y-3 text-sm">
                      {application.education.map((e, i) => (
                        <li key={i}>
                          <p className="font-medium">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || e.institution}</p>
                          <p className="text-mist">
                            {e.institution}
                            {e.endDate ? ` · ${e.endDate}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section className="rounded-[22px] glass-card p-5">
              <h2 className="caption">{t("Brukt i prosjekter")}</h2>
              {application.usedTech.length > 0 ? (
                <>
                  <UsedTech tech={application.usedTech} max={8} className="mt-3" />
                  <p className="mt-2 text-xs text-mist">{t("Tallet er hvor mange publiserte prosjekter teknologien er brukt i.")}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-mist">{t("Ingen teknologier på prosjektene ennå.")}</p>
              )}
              {application.skills.length > 0 && (
                <>
                  <h3 className="caption mt-5">{t("Ferdigheter fra CV-en")}</h3>
                  <p className="mt-2 text-sm text-mist">{application.skills.slice(0, 15).join(" · ")}</p>
                </>
              )}
              {c.openTo.length > 0 && <p className="mt-4 text-xs text-success">{t("Åpen for")} {c.openTo.map((o) => t(OPEN_TO_LABELS[o]).toLowerCase()).join(", ")}</p>}
            </section>

            <section className="rounded-[22px] glass-card p-5">
              <h2 className="caption">{t("Notat")}</h2>
              <div className="mt-3">
                {business ? <ApplicantNote id={application.id} initial={application.note} /> : <p className="text-sm text-mist">{t("Notater krever Bedrift.")}</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
