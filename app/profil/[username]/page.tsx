import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Download, FileText, FolderPlus, MapPin, Printer } from "lucide-react";
import Avatar from "@/components/Avatar";
import CvView from "@/components/cv/CvView";
import CvPages from "@/components/CvPages";
import Markdown from "@/components/Markdown";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import ActivityHeatmap from "@/components/profile/ActivityHeatmap";
import { hostLabel, linkIcon } from "@/components/profile/LinkIcon";
import ProfileActions from "@/components/profile/ProfileActions";
import ProjectCard, { ProjectGrid } from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/button";
import { compactNumber, EmptyState, Tag } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import ViewTracker from "@/components/ViewTracker";
import { getActivityByDay } from "@/lib/activity";
import { ACCENTS, CV_TEMPLATE_LABELS, OPEN_TO_LABELS } from "@/lib/constants";
import { countPublicCollections, listPublicCollections } from "@/lib/collections";
import { isPro } from "@/lib/billing";
import { buildCvViewData, effectiveTemplate } from "@/lib/cv-view";
import { showsBranding } from "@/lib/pro";
import { formatPeriod } from "@/lib/format";
import { getOnboarding, getProfileBase, getProfileByUsername } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { shownUsername } from "@/lib/username";
import { dateLocale, makeT, type Locale } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ fane?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const [profile, t] = await Promise.all([getProfileBase(decodeURIComponent(username)), getT()]);
  if (!profile) return { title: t("Fant ikke profilen"), robots: { index: false } };
  const handle = shownUsername(profile);
  const description = profile.headline ?? profile.bio?.slice(0, 160) ?? t("Prosjektene og CV-en til {name} på Vis.", { name: profile.name });
  return {
    title: `${profile.name} (@${handle})`,
    description,
    alternates: { canonical: `/@${profile.username}` },
    openGraph: { type: "profile", title: t("{name} på Vis", { name: profile.name }), description, url: `/@${profile.username}`, username: handle },
    twitter: { card: "summary_large_image", title: t("{name} på Vis", { name: profile.name }), description },
  };
}

const monthYear = (d: Date, locale: Locale) => d.toLocaleDateString(dateLocale(locale), { month: "long", year: "numeric" });

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ username }, { fane }] = await Promise.all([params, searchParams]);
  const [viewer, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = makeT(locale);
  const profile = await getProfileByUsername(decodeURIComponent(username), viewer?.id);
  if (!profile) notFound();

  const tab = fane === "prosjekter" || fane === "cv" || fane === "samlinger" ? fane : "oversikt";
  const base = `/@${profile.username}`;
  const accent = ACCENTS[profile.accentColor ?? "is"];
  const [activity, steps, collectionCount, collections, ownerPro, showBrand] = await Promise.all([
    tab === "oversikt" ? getActivityByDay(profile.id) : null,
    profile.isOwner ? getOnboarding(profile.id, profile.username) : [],
    countPublicCollections(profile.id),
    tab === "samlinger" ? listPublicCollections(profile.id) : [],
    isPro(profile.id),
    tab === "cv" ? showsBranding(profile.id) : true,
  ]);

  const visibleProjects = profile.projects;
  const publishedCount = profile.projects.filter((p) => p.status === "published" && !p.removed).length;
  const pinned = visibleProjects.filter((p) => p.pinned);
  const featured = (pinned.length > 0 ? pinned : visibleProjects).slice(0, 4);
  // Teknologiene som går igjen i prosjektene, flest først.
  const tagCounts = new Map<string, { slug: string; name: string; count: number }>();
  for (const p of visibleProjects) {
    for (const tag of p.tags) {
      const entry = tagCounts.get(tag.slug) ?? { ...tag, count: 0 };
      entry.count++;
      tagCounts.set(tag.slug, entry);
    }
  }
  const topTags = [...tagCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "nb")).slice(0, 10);
  const hasStructuredCv = profile.cv.experience.length + profile.cv.education.length + profile.cv.skills.length > 0;
  const hasCv = hasStructuredCv || Boolean(profile.cvDocument) || Boolean(profile.bio);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: profile.name,
      alternateName: `@${shownUsername(profile)}`,
      description: profile.headline ?? profile.bio ?? undefined,
      image: profile.image ?? undefined,
      address: profile.location ? { "@type": "PostalAddress", addressLocality: profile.location } : undefined,
      url: `${siteUrl()}${base}`,
      sameAs: [profile.websiteUrl, ...profile.links.map((l) => l.url)].filter(Boolean),
      knowsAbout: profile.cv.skills.slice(0, 20),
    },
  };

  return (
    <main style={{ "--accent": accent.color } as CSSProperties} className="pb-28 md:pb-20 md:pl-24">
      <ViewTracker kind="profile" id={profile.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Banner i profilens aksentfarge: lys, et svakt rutenett og sirkler. */}
      <div className="mx-auto max-w-7xl px-5 pt-2 md:px-10 md:pt-8">
        <div aria-hidden="true" className="glass-card relative h-40 overflow-hidden rounded-[28px] md:h-60">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(70% 130% at 88% -10%, color-mix(in srgb, ${accent.color} 55%, transparent), transparent 70%), radial-gradient(55% 110% at 0% 110%, color-mix(in srgb, ${accent.color} 22%, transparent), transparent 70%)`,
            }}
          />
          <div
            className="absolute inset-0 [mask-image:radial-gradient(90%_120%_at_70%_0%,black,transparent_75%)]"
            style={{
              backgroundImage: `linear-gradient(color-mix(in srgb, var(--fg) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--fg) 8%, transparent) 1px, transparent 1px)`,
              backgroundSize: "44px 44px",
            }}
          />
          <div className="absolute -bottom-28 right-[10%] size-72 rounded-full border md:size-96" style={{ borderColor: `color-mix(in srgb, ${accent.color} 45%, transparent)` }} />
          <div className="absolute -bottom-44 right-[4%] size-[26rem] rounded-full border md:size-[34rem]" style={{ borderColor: `color-mix(in srgb, ${accent.color} 25%, transparent)` }} />
          <span className="glass-rim" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 md:px-10 lg:grid-cols-[340px_minmax(0,1fr)] xl:gap-14">
        {/* ------------------------------------------------------------------ */}
        {/* Visittkortet                                                       */}
        {/* ------------------------------------------------------------------ */}
        <aside className="-mt-14 lg:sticky lg:top-6 lg:-mt-20 lg:self-start">
          <Avatar
            name={profile.name}
            image={profile.image}
            size={120}
            className="relative z-10 ml-4 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)] ring-4 ring-ink md:ml-6"
          />
          <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.035em] md:text-[2.1rem]">{profile.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-mist">
            @{shownUsername(profile)}
            {ownerPro && (
              <Link href="/priser" className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn" title={t("Har Vis Pro")}>
                Pro
              </Link>
            )}
          </p>
          {profile.headline && <p className="mt-3 text-lg leading-7 text-fg">{profile.headline}</p>}

          {profile.openTo.length > 0 && (
            <div className="mt-5 rounded-[18px] bg-success/10 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-success">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                {t("Åpen for")}
              </p>
              <p className="mt-1.5 text-sm text-fg">{profile.openTo.map((o) => t(OPEN_TO_LABELS[o])).join(" · ")}</p>
            </div>
          )}

          <div className="mt-6">
            <ProfileActions
              userId={profile.id}
              username={profile.username}
              name={profile.name}
              isOwner={profile.isOwner}
              isFollowing={profile.isFollowing}
              loggedIn={Boolean(viewer)}
              contactEnabled={Boolean(profile.contactEnabled)}
            />
          </div>

          <dl className="mt-6 grid grid-cols-4 divide-x divide-line overflow-hidden rounded-[18px] glass-card text-center">
            {[
              { label: t("Prosjekter"), value: publishedCount, href: `${base}?fane=prosjekter` },
              { label: t("Følgere"), value: profile.followers, href: `${base}/folgere` },
              { label: t("Følger"), value: profile.following, href: `${base}/folger` },
              { label: t("Reaksjoner"), value: profile.reactionsReceived },
            ].map((s) => {
              const inner = (
                <>
                  <dd className="text-lg font-semibold tabular-nums tracking-tight">{compactNumber(s.value)}</dd>
                  <dt className="text-[11px] text-mist">{s.label}</dt>
                </>
              );
              return s.href ? (
                <Link key={s.label} href={s.href} className="flex flex-col-reverse px-1 py-3 transition hover:bg-fill">
                  {inner}
                </Link>
              ) : (
                <div key={s.label} className="flex flex-col-reverse px-1 py-3">
                  {inner}
                </div>
              );
            })}
          </dl>

          {/* Sted, når de ble med og lenkene, samlet i én gruppe som i Innstillinger på iOS. */}
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[18px] glass-card text-sm">
            {profile.location && (
              <li className="flex items-center gap-3 px-4 py-3">
                <MapPin className="size-4 shrink-0 text-mist" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{profile.location}</span>
              </li>
            )}
            <li className="flex items-center gap-3 px-4 py-3">
              <CalendarDays className="size-4 shrink-0 text-mist" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t("På Vis siden {date}", { date: monthYear(profile.createdAt, locale) })}</span>
            </li>
            {[...(profile.websiteUrl ? [{ label: hostLabel(profile.websiteUrl), url: profile.websiteUrl }] : []), ...profile.links].map((link) => {
              const Icon = linkIcon(link.url);
              return (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer me"
                    className="group flex items-center gap-3 px-4 py-3 text-fg transition hover:bg-fill"
                  >
                    <Icon className="size-4 shrink-0 text-mist group-hover:text-accent" />
                    <span className="min-w-0 flex-1 truncate">{link.label}</span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-mist" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>

          {topTags.length > 0 && (
            <section className="mt-6">
              <h2 className="px-1 caption">{t("Jobber med")}</h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {topTags.map((tag) => (
                  <Tag key={tag.slug} href={`/tag/${tag.slug}`} count={tag.count > 1 ? tag.count : undefined}>
                    {tag.name}
                  </Tag>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* ------------------------------------------------------------------ */}
        {/* Faner                                                              */}
        {/* ------------------------------------------------------------------ */}
        <section className="min-w-0 lg:pt-6">
          <div>
            <Tabs
              label={t("Profil")}
              active={tab}
              items={[
                { key: "oversikt", label: t("Oversikt"), href: base },
                { key: "prosjekter", label: t("Prosjekter"), href: `${base}?fane=prosjekter`, count: visibleProjects.length },
                ...(hasCv || profile.isOwner ? [{ key: "cv", label: "CV", href: `${base}?fane=cv` }] : []),
                ...(collectionCount > 0 ? [{ key: "samlinger", label: t("Samlinger"), href: `${base}?fane=samlinger`, count: collectionCount }] : []),
              ]}
            />
          </div>

          <div className="pt-8">
            {tab === "oversikt" && (
              <div className="space-y-12">
                {profile.isOwner && <OnboardingChecklist steps={steps} title="Gjør ferdig profilen" />}

                {profile.lookingFor && (
                  <div className="rounded-[22px] p-6" style={{ background: `color-mix(in srgb, ${accent.color} 10%, transparent)` }}>
                    <p className="caption">{t("Ser etter")}</p>
                    <p className="mt-2 text-xl leading-8 tracking-[-0.015em] text-fg">{profile.lookingFor}</p>
                  </div>
                )}

                {(profile.readme || profile.bio) && (
                  <section>
                    <h2 className="caption">{t("Om meg")}</h2>
                    <div className="mt-4">
                      {profile.readme ? (
                        <>
                          {profile.bio && <p className="mb-6 text-xl leading-8 tracking-tight text-fg">{profile.bio}</p>}
                          <Markdown>{profile.readme}</Markdown>
                        </>
                      ) : (
                        <p className="whitespace-pre-line text-xl leading-8 tracking-tight text-fg">{profile.bio}</p>
                      )}
                    </div>
                  </section>
                )}

                <section>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="caption">{t(pinned.length > 0 ? "Festede prosjekter" : "Prosjekter")}</h2>
                    {visibleProjects.length > featured.length && (
                      <Link href={`${base}?fane=prosjekter`} className="text-sm text-mist transition hover:text-fg">
                        {t("Alle {n}", { n: visibleProjects.length })} <ArrowRight className="inline size-3.5" />
                      </Link>
                    )}
                  </div>
                  <div className="mt-5">
                    {featured.length > 0 ? (
                      <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2">
                        {featured.map((p, i) => (
                          <ProjectCard key={p.id} project={p} showOwner={false} priority={i < 2} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<FolderPlus className="size-5" />}
                        title={t(profile.isOwner ? "Del ditt første prosjekt" : "Ingen prosjekter ennå")}
                        action={profile.isOwner ? <ButtonLink href="/ny">{t("Del et prosjekt")}</ButtonLink> : undefined}
                      >
                        {profile.isOwner ? t("Fra GitHub, en mappe på maskinen eller med noen bilder. Det tar et minutt.") : t("{name} har ikke delt noe ennå.", { name: profile.name })}
                      </EmptyState>
                    )}
                  </div>
                </section>

                {activity && (
                  <section>
                    <h2 className="caption">{t("Aktivitet")}</h2>
                    <div className="mt-4 rounded-[22px] glass-card p-5">
                      <ActivityHeatmap byDay={activity.byDay} projects={activity.projects} comments={activity.comments} />
                    </div>
                  </section>
                )}

                {profile.cv.experience.length > 0 && (
                  <section>
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="caption">{t("Erfaring")}</h2>
                      <Link href={`${base}?fane=cv`} className="text-sm text-mist transition hover:text-fg">
                        {t("Hele CV-en")} <ArrowRight className="inline size-3.5" />
                      </Link>
                    </div>
                    <ol className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] glass-card px-5">
                      {profile.cv.experience.slice(0, 3).map((e) => (
                        <li key={e.id} className="grid gap-1 py-5 sm:grid-cols-[160px_1fr] sm:gap-8">
                          <p className="text-[13px] text-mist sm:pt-0.5">{formatPeriod(e.startDate, e.endDate, locale)}</p>
                          <div>
                            <p className="font-semibold text-fg">{e.title}</p>
                            <p className="text-sm text-accent">
                              {e.organization}
                              {e.location && <span className="text-mist"> · {e.location}</span>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {profile.cv.skills.length > 0 && (
                  <section>
                    <h2 className="caption">{t("Kompetanse")}</h2>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {profile.cv.skills.map((s) => (
                        <Tag key={s} href={`/sok?type=personer&q=${encodeURIComponent(s)}`}>
                          {s}
                        </Tag>
                      ))}
                    </div>
                  </section>
                )}

                {profile.customSections.map((s) => (
                  <section key={s.id}>
                    <h2 className="caption">{s.title}</h2>
                    <div className="mt-4">
                      <Markdown>{s.body}</Markdown>
                    </div>
                  </section>
                ))}
              </div>
            )}

            {tab === "prosjekter" &&
              (visibleProjects.length > 0 ? (
                <ProjectGrid projects={visibleProjects} showOwner={false} columns={2} />
              ) : (
                <EmptyState
                  icon={<FolderPlus className="size-5" />}
                  title={t(profile.isOwner ? "Du har ingen prosjekter ennå" : "Ingen prosjekter ennå")}
                  action={profile.isOwner ? <ButtonLink href="/ny">{t("Del et prosjekt")}</ButtonLink> : undefined}
                >
                  {profile.isOwner ? t("Del noe du har laget, fra GitHub, en mappe eller for hånd.") : undefined}
                </EmptyState>
              ))}

            {tab === "samlinger" &&
              (collections.length > 0 ? (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {collections.map((c) => (
                    <li key={c.id}>
                      <Link href={`/samling/${c.id}`} className="group block rounded-[22px] glass-card p-3 transition hover:bg-card-hover">
                        <div className="grid aspect-[16/7] grid-cols-3 gap-1.5 overflow-hidden rounded-[14px]">
                          {[0, 1, 2].map((i) =>
                            c.covers[i] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={c.covers[i]!} alt="" className="size-full object-cover" loading="lazy" />
                            ) : (
                              <span key={i} className="bg-fill" />
                            ),
                          )}
                        </div>
                        <p className="mt-3 px-1 font-semibold group-hover:text-ice">{c.title}</p>
                        <p className="px-1 pb-1 text-sm text-mist">
                          {t(c.count === 1 ? "1 prosjekt" : "{n} prosjekter", { n: c.count })}
                          {c.description ? ` · ${c.description}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<FolderPlus className="size-5" />} title={t("Ingen offentlige samlinger")}>
                  {profile.isOwner ? t("Lagre prosjekter med bokmerket og gjør samlingen offentlig.") : undefined}
                </EmptyState>
              ))}

            {tab === "cv" &&
              (hasCv ? (
                <div className="space-y-12">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-mist">
                      {t("Mal:")} <span className="font-medium text-fg">{t(CV_TEMPLATE_LABELS[effectiveTemplate(profile.cvTemplate, ownerPro)].name)}</span>
                      {profile.isOwner && (
                        <Link href="/profil/rediger/cv" className="ml-3 text-ice hover:underline">
                          {t("Bytt mal eller rediger")}
                        </Link>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <ButtonLink href={`${base}/cv`} variant="secondary" size="sm">
                        <FileText className="size-4" /> {t("Delbar CV")}
                      </ButtonLink>
                      <ButtonLink href={`${base}/cv?skriv=1`} size="sm">
                        <Printer className="size-4" /> {t("Last ned PDF")}
                      </ButtonLink>
                    </div>
                  </div>
                  <div className="-mx-5 overflow-hidden bg-fill px-3 py-8 sm:mx-0 sm:rounded-[28px] sm:px-8 sm:py-10">
                    <CvView data={buildCvViewData(profile, { branding: showBrand, locale })} template={effectiveTemplate(profile.cvTemplate, ownerPro)} />
                  </div>

                  {profile.cvDocument && profile.cvDocument.pages.length > 0 && (
                    <section>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2 className="caption">{t("Opplastet CV")}</h2>
                        <a href={profile.cvDocument.fileUrl} download className="inline-flex items-center gap-2 text-sm text-ice hover:underline">
                          <Download className="size-4" /> {t("Last ned originalen")}
                        </a>
                      </div>
                      {profile.isOwner && !profile.cvDocument.isPublic && <p className="mt-2 text-sm text-warn">{t("Skjult for andre. Bare du ser den.")}</p>}
                      <div className="mx-auto mt-6 max-w-[820px]">
                        <CvPages pages={profile.cvDocument.pages} fileUrl={profile.cvDocument.fileUrl} name={profile.name} />
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={<FileText className="size-5" />}
                  title={t("Ingen CV ennå")}
                  action={profile.isOwner ? <ButtonLink href="/profil/rediger/cv">{t("Importer CV-en")}</ButtonLink> : undefined}
                >
                  {profile.isOwner ? t("Last opp PDF eller Word, så fyller vi ut erfaring, utdanning og ferdigheter.") : undefined}
                </EmptyState>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
