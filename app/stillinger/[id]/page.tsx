import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Building2, CalendarClock, MapPin, Settings } from "lucide-react";
import JobViewCounter from "@/components/company/JobViewCounter";
import Markdown from "@/components/Markdown";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/misc";
import { getMembership } from "@/lib/companies";
import { JOB_TYPE_LABELS, REMOTE_LABELS } from "@/lib/constants";
import { getJob } from "@/lib/jobs";
import { getCurrentUser } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { dateLocale, makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [job, t] = await Promise.all([getJob((await params).id), getT()]);
  if (!job) return { title: t("Fant ikke stillingen") };
  const kind = t(JOB_TYPE_LABELS[job.type as keyof typeof JOB_TYPE_LABELS] ?? "Stilling");
  return {
    title: `${job.title} – ${job.company.name}`,
    description: job.location
      ? t("{type} hos {company} i {place}.", { type: kind, company: job.company.name, place: job.location })
      : t("{type} hos {company}.", { type: kind, company: job.company.name }),
    robots: job.isOpen ? undefined : { index: false },
  };
}

const EMPLOYMENT: Record<string, string> = { fulltid: "FULL_TIME", deltid: "PART_TIME", internship: "INTERN", sommerjobb: "TEMPORARY", trainee: "FULL_TIME", frilans: "CONTRACTOR" };

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  const [viewer, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = makeT(locale);
  const preview = await getJob(id);
  const role = preview ? await getMembership(viewer?.id, preview.companyId) : null;
  const job = role ? await getJob(id, { asMember: true }) : preview;
  if (!job) notFound();

  // Strukturert data, så stillingen kan dukke opp i Google sitt jobbsøk.
  const jsonLd = job.isOpen
    ? {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: job.title,
        description: job.description || job.title,
        datePosted: job.publishedAt?.toISOString(),
        ...(job.deadline ? { validThrough: `${job.deadline}T23:59:59` } : {}),
        employmentType: EMPLOYMENT[job.type] ?? "FULL_TIME",
        hiringOrganization: {
          "@type": "Organization",
          name: job.company.name,
          ...(job.company.website ? { sameAs: job.company.website } : {}),
          ...(job.company.logoUrl ? { logo: job.company.logoUrl.startsWith("/") ? `${siteUrl()}${job.company.logoUrl}` : job.company.logoUrl } : {}),
        },
        ...(job.remote === "helt"
          ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "Norway" } }
          : { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location ?? undefined, addressCountry: "NO" } } }),
        directApply: false,
      }
    : null;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      {job.isOpen && <JobViewCounter id={job.id} />}
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <Link href={`/bedrift/${job.company.slug}`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
            <span className="flex size-7 items-center justify-center overflow-hidden rounded-lg bg-fill">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {job.company.logoUrl ? <img src={job.company.logoUrl} alt="" className="size-full object-cover" /> : <Building2 className="size-4" />}
            </span>
            {job.company.name}
            {job.company.verifiedAt && <BadgeCheck className="size-4 text-sea" aria-label={t("Bekreftet")} />}
          </Link>
          <h1 className="display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]">{job.title}</h1>
          {!job.isOpen && <p className="mt-4 rounded-2xl bg-fill px-4 py-3 text-sm text-mist">{t(job.status === "draft" ? "Utkast – bare bedriften ser dette." : "Stillingen er ikke lenger åpen.")}</p>}
          {job.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {job.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          )}
          <div className="mt-10">{job.description ? <Markdown>{job.description}</Markdown> : <p className="text-mist">{t("Ingen beskrivelse.")}</p>}</div>
        </article>
        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <section className="rounded-[22px] glass-card p-5">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-mist">{t("Type")}</dt>
                <dd className="font-medium">{t(JOB_TYPE_LABELS[job.type as keyof typeof JOB_TYPE_LABELS] ?? job.type)}</dd>
              </div>
              <div>
                <dt className="text-mist">{t("Sted")}</dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  <MapPin className="size-4 text-mist" /> {[job.location, t(REMOTE_LABELS[job.remote as keyof typeof REMOTE_LABELS] ?? "")].filter(Boolean).join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="text-mist">{t("Søknadsfrist")}</dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  <CalendarClock className="size-4 text-mist" />
                  {job.deadline ? new Date(`${job.deadline}T12:00:00`).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long", year: "numeric" }) : t("Løpende")}
                </dd>
              </div>
            </dl>
            {job.isOpen && (
              <a href={`/stillinger/${job.id}/sok`} rel="nofollow" className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary transition hover:opacity-90">
                {t("Søk på stillingen")} <ArrowUpRight className="size-4" />
              </a>
            )}
          </section>
          {role && (
            <ButtonLink href={`/bedrift/${job.company.slug}/admin/stilling/${job.id}`} variant="secondary" size="sm" className="w-full">
              <Settings className="size-4" /> {t("Rediger stillingen")}
            </ButtonLink>
          )}
        </aside>
      </div>
    </main>
  );
}
