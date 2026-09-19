import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { ui } from "@/components/ui";
import { getProfileByUsername } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ username: string }> };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

// "2024-05" -> "mai 2024"
function formatYearMonth(value: string | null) {
  if (!value) return null;
  const [year, month] = value.split("-");
  if (!month) return year;
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("nb-NO", { month: "short", year: "numeric" });
}

function period(start: string | null, end: string | null) {
  const from = formatYearMonth(start);
  const to = end ? formatYearMonth(end) : "nå";
  return from ? `${from} – ${to}` : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) return { title: "Fant ikke profilen – vis" };
  return {
    title: `${profile.name} (@${profile.username}) – vis`,
    description: profile.headline ?? profile.bio?.slice(0, 160) ?? `Prosjektene til ${profile.name} på vis.`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  const user = await getProfileByUsername(decodeURIComponent(username), viewer?.id);

  if (!user) notFound();

  const hasCv = user.cv.experience.length > 0 || user.cv.education.length > 0 || user.cv.skills.length > 0;

  return (
    <main className="min-h-screen bg-[#071A52] text-white">
      <SiteHeader />

      <section className="border-b border-[#174B76]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#C7F9FF] text-3xl font-bold text-[#071A52]">
                {initials(user.name)}
              </div>
            )}

            <div>
              <h1 className="text-3xl font-bold">{user.name}</h1>
              <p className="mt-1 text-[#C7F9FF]">@{user.username}</p>
              {user.headline && <p className="mt-2 font-medium">{user.headline}</p>}
              {user.location && <p className="mt-2 text-sm text-[#B8D8E3]">{user.location}</p>}
              {user.bio && <p className="mt-4 max-w-2xl whitespace-pre-line leading-7 text-[#B8D8E3]">{user.bio}</p>}

              {(user.websiteUrl || user.links.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {user.websiteUrl && (
                    <a href={user.websiteUrl} target="_blank" rel="noreferrer" className="text-[#C7F9FF] underline">
                      Nettside
                    </a>
                  )}
                  {user.links.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="text-[#C7F9FF] underline">
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-[#C7F9FF]">Portefølje</p>
            <h2 className="mt-2 text-2xl font-bold">Prosjekter</h2>
          </div>

          {user.isOwner ? (
            <div className="flex gap-2">
              <Link href="/importer" className={`${ui.secondary} text-sm`}>
                Importer
              </Link>
              <Link href="/ny" className={`${ui.primary} text-sm`}>
                Nytt prosjekt
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[#B8D8E3]">{user.projects.length} prosjekter</p>
          )}
        </div>

        {user.projects.length === 0 ? (
          <p className="mt-7 text-[#B8D8E3]">
            {user.isOwner ? "Du har ingen prosjekter ennå. Legg til ett, eller importer fra GitHub." : "Ingen prosjekter ennå."}
          </p>
        ) : (
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {user.projects.map((project) => (
              <Link
                key={project.id}
                href={`/prosjekt/${project.id}`}
                className="group overflow-hidden rounded-2xl border border-[#174B76] bg-[#0A245E] transition hover:-translate-y-1 hover:border-[#C7F9FF] hover:shadow-xl hover:shadow-black/20"
              >
                {project.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.coverImageUrl} alt="" className="aspect-video w-full object-cover" />
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold transition group-hover:text-[#C7F9FF]">{project.title}</h3>
                    {project.status === "draft" && (
                      <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-200">Utkast</span>
                    )}
                  </div>
                  {project.summary && <p className="mt-3 text-sm leading-6 text-[#B8D8E3]">{project.summary}</p>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span key={tag.slug} className={ui.tag}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {(hasCv || user.isOwner) && (
        <section className="border-t border-[#174B76]">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-widest text-[#C7F9FF]">CV</p>
                <h2 className="mt-2 text-2xl font-bold">Erfaring og utdanning</h2>
              </div>
              {user.isOwner && (
                <Link href="/importer#cv" className={`${ui.secondary} text-sm`}>
                  {hasCv ? "Importer ny CV" : "Importer CV"}
                </Link>
              )}
            </div>

            {!hasCv && <p className="mt-7 text-[#B8D8E3]">Importer CV-en din, så fyller vi ut feltene for deg.</p>}

            {user.cv.experience.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold">Erfaring</h3>
                <ul className="mt-4 space-y-5">
                  {user.cv.experience.map((e) => (
                    <li key={e.id} className="border-l-2 border-[#174B76] pl-4">
                      <p className="font-medium">
                        {e.title} · <span className="text-[#C7F9FF]">{e.organization}</span>
                      </p>
                      <p className="text-sm text-[#B8D8E3]">{[period(e.startDate, e.endDate), e.location].filter(Boolean).join(" · ")}</p>
                      {e.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#B8D8E3]">{e.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {user.cv.education.length > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-semibold">Utdanning</h3>
                <ul className="mt-4 space-y-5">
                  {user.cv.education.map((e) => (
                    <li key={e.id} className="border-l-2 border-[#174B76] pl-4">
                      <p className="font-medium">{e.institution}</p>
                      <p className="text-sm text-[#B8D8E3]">
                        {[e.degree, e.fieldOfStudy, period(e.startDate, e.endDate)].filter(Boolean).join(" · ")}
                      </p>
                      {e.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#B8D8E3]">{e.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {user.cv.skills.length > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-semibold">Ferdigheter</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {user.cv.skills.map((skill) => (
                    <span key={skill} className={ui.tag}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
