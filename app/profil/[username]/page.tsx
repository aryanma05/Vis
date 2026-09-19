import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import CvPages from "@/components/CvPages";
import CvTimeline from "@/components/CvTimeline";
import { ProjectGrid } from "@/components/ProjectCard";
import SiteHeader from "@/components/SiteHeader";
import { ArrowIcon, DownloadIcon } from "@/components/icons";
import { getProfileByUsername } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ fane?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) return { title: "Fant ikke profilen – vis" };
  return {
    title: `${profile.name} (@${profile.username}) – vis`,
    description: profile.headline ?? profile.bio?.slice(0, 160) ?? `Prosjektene til ${profile.name} på vis.`,
  };
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ username }, { fane }] = await Promise.all([params, searchParams]);
  const viewer = await getCurrentUser();
  const user = await getProfileByUsername(decodeURIComponent(username), viewer?.id);
  if (!user) notFound();

  const tab = fane === "cv" ? "cv" : "prosjekter";
  const hasStructuredCv = user.cv.experience.length + user.cv.education.length + user.cv.skills.length > 0;
  const pages = user.cvDocument?.pages ?? [];
  const hasCv = hasStructuredCv || Boolean(user.cvDocument);
  const base = `/@${user.username}`;

  const tabClass = (active: boolean) =>
    `-mb-px border-b-2 pb-4 text-sm font-medium transition ${
      active ? "border-ice text-white" : "border-transparent text-mist hover:text-white"
    }`;

  return (
    <main className="min-h-screen bg-ink text-white">
      <SiteHeader />

      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-6 pt-14 md:pt-20">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <Avatar name={user.name} image={user.image} size={120} className="rounded-2xl" />
              <div>
                <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{user.name}</h1>
                <p className="mt-2 text-mist">
                  @{user.username}
                  {user.location && <span className="text-mist/60"> · {user.location}</span>}
                </p>
              </div>
            </div>

            {user.isOwner && (
              <Link
                href="/profil/rediger"
                className="self-start rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-ice md:self-auto"
              >
                Rediger profil
              </Link>
            )}
          </div>

          {user.headline && <p className="mt-10 max-w-3xl text-2xl leading-snug text-white md:text-3xl">{user.headline}</p>}
          {user.bio && <p className="mt-5 max-w-2xl whitespace-pre-line leading-7 text-mist">{user.bio}</p>}

          {(user.websiteUrl || user.links.length > 0) && (
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {user.websiteUrl && (
                <li>
                  <a href={user.websiteUrl} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1.5 text-mist hover:text-ice">
                    {hostLabel(user.websiteUrl)}
                    <ArrowIcon className="h-3.5 w-3.5 -rotate-45 transition group-hover:translate-x-0.5" />
                  </a>
                </li>
              )}
              {user.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1.5 text-mist hover:text-ice">
                    {link.label}
                    <ArrowIcon className="h-3.5 w-3.5 -rotate-45 transition group-hover:translate-x-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          <nav className="mt-12 flex gap-8" aria-label="Profil">
            <Link href={base} scroll={false} className={tabClass(tab === "prosjekter")}>
              Prosjekter <span className="ml-1 font-mono text-xs text-mist/60">{user.projects.length}</span>
            </Link>
            {(hasCv || user.isOwner) && (
              <Link href={`${base}?fane=cv`} scroll={false} className={tabClass(tab === "cv")}>
                CV
              </Link>
            )}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        {tab === "prosjekter" ? (
          user.projects.length > 0 ? (
            <ProjectGrid projects={user.projects} showOwner={false} />
          ) : (
            <div className="rounded-xl border border-dashed border-line px-6 py-20 text-center">
              <p className="text-xl font-semibold">{user.isOwner ? "Du har ingen prosjekter ennå." : "Ingen prosjekter ennå."}</p>
              {user.isOwner && (
                <>
                  <p className="mt-2 text-mist">Del noe du har laget, fra GitHub, en mappe eller for hånd.</p>
                  <Link href="/ny" className="mt-6 inline-flex rounded-lg bg-ice px-5 py-3 font-semibold text-ink transition hover:bg-white">
                    Del et prosjekt
                  </Link>
                </>
              )}
            </div>
          )
        ) : !hasCv ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-20 text-center">
            <p className="text-xl font-semibold">Ingen CV ennå.</p>
            <p className="mt-2 text-mist">Last opp CV-en som PDF eller bilde, så vises den her i full oppløsning.</p>
            <Link href="/profil/rediger/cv" className="mt-6 inline-flex rounded-lg bg-ice px-5 py-3 font-semibold text-ink transition hover:bg-white">
              Legg til CV
            </Link>
          </div>
        ) : pages.length > 0 ? (
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-20">
            <div className="mx-auto w-full max-w-[820px]">
              <CvPages pages={pages} fileUrl={user.cvDocument!.fileUrl} name={user.name} />
            </div>
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="flex flex-wrap gap-3">
                <a
                  href={user.cvDocument!.fileUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-ice px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-white"
                >
                  <DownloadIcon /> Last ned CV
                </a>
                {user.isOwner && (
                  <Link href="/profil/rediger/cv" className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition hover:border-ice">
                    Rediger
                  </Link>
                )}
              </div>
              {user.isOwner && !user.cvDocument!.isPublic && (
                <p className="mt-4 text-sm text-amber-200">CV-dokumentet er skjult. Bare du ser det.</p>
              )}
              {hasStructuredCv && (
                <div className="mt-10">
                  <CvTimeline cv={user.cv} />
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div className="max-w-4xl">
            {user.isOwner && (
              <div className="mb-10 flex justify-end">
                <Link href="/profil/rediger/cv" className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition hover:border-ice">
                  Rediger CV
                </Link>
              </div>
            )}
            {user.cvDocument && (
              <a href={user.cvDocument.fileUrl} target="_blank" rel="noreferrer" className="mb-10 inline-flex items-center gap-2 text-ice underline-offset-4 hover:underline">
                <DownloadIcon /> Last ned CV ({user.cvDocument.fileName})
              </a>
            )}
            <CvTimeline cv={user.cv} wide />
          </div>
        )}
      </section>
    </main>
  );
}
