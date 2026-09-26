import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Hash } from "lucide-react";
import Avatar from "@/components/Avatar";
import { ProjectGrid } from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Tag } from "@/components/ui/misc";
import { getRelatedTags, getTagBySlug, getTopCreatorsForTag, searchProjects } from "@/lib/projects";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await getTagBySlug(decodeURIComponent((await params).slug));
  if (!tag) return { title: "Fant ikke teknologien", robots: { index: false } };
  return {
    title: `${tag.name}-prosjekter`,
    description: `Prosjekter laget med ${tag.name} av utviklere og designere i Norden, og folkene bak dem.`,
    alternates: { canonical: `/tag/${tag.slug}` },
  };
}

// Egen side per teknologi: prosjektene, folkene som bruker den mest og beslektede teknologier.
export default async function TagPage({ params, searchParams }: Props) {
  const [{ slug }, { sort }] = await Promise.all([params, searchParams]);
  const tag = await getTagBySlug(decodeURIComponent(slug));
  if (!tag) notFound();

  const order = sort === "trending" ? "trending" : sort === "popular" ? "popular" : "newest";
  const [projects, creators, related] = await Promise.all([
    searchProjects("", { tag: tag.slug, sort: order, limit: 48 }),
    getTopCreatorsForTag(tag.slug, 6),
    getRelatedTags(tag.slug, 12),
  ]);

  return (
    <main className="pb-28 md:pb-20 md:pl-24">
      <header className="blueprint border-b border-line">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-12 md:px-10 md:pb-16 md:pt-20">
          <p className="label-mono inline-flex items-center gap-2">
            <Hash className="size-3.5" /> Teknologi
          </p>
          <h1 className="mt-4 display text-[clamp(3rem,9vw,7.5rem)]">{tag.name}</h1>
          <p className="mt-5 text-lg text-mist">
            {projects.length} {projects.length === 1 ? "prosjekt" : "prosjekter"} fra {creators.length}{" "}
            {creators.length === 1 ? "person" : "personer"} på Vis.
          </p>
          {related.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-mist">Ofte sammen med</span>
              {related.map((t) => (
                <Tag key={t.slug} href={`/tag/${t.slug}`} count={t.count}>
                  {t.name}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-12 md:px-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-8 flex flex-wrap items-center gap-2">
            {[
              ["newest", "Nyeste"],
              ["trending", "Trender"],
              ["popular", "Mest likt"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={key === "newest" ? `/tag/${tag.slug}` : `/tag/${tag.slug}?sort=${key}`}
                scroll={false}
                className={`rounded-xl border px-3.5 py-1.5 text-sm font-medium transition ${
                  order === key ? "border-primary bg-primary text-on-primary" : "border-line text-mist hover:text-fg"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          {projects.length > 0 ? (
            <ProjectGrid projects={projects} columns={2} />
          ) : (
            <EmptyState title={`Ingen publiserte prosjekter med ${tag.name} ennå`} action={<ButtonLink href="/ny">Del et prosjekt</ButtonLink>} />
          )}
        </section>

        {creators.length > 0 && (
          <aside className="xl:sticky xl:top-8 xl:self-start">
            <h2 className="label-mono">Folk som bruker {tag.name}</h2>
            <ul className="mt-5 space-y-4">
              {creators.map((c) => (
                <li key={c.id}>
                  <Link href={`/@${c.username}`} className="group flex items-center gap-3">
                    <Avatar name={c.name} image={c.image} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium group-hover:text-ice">{c.name}</span>
                      <span className="block truncate text-[13px] text-mist">{c.headline ?? `@${c.username}`}</span>
                    </span>
                    <span className="font-mono text-xs text-mist">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ButtonLink href={`/sok?type=personer&tag=${tag.slug}`} variant="outline" size="sm" className="mt-6 w-full">
              Finn flere <ArrowRight className="size-4" />
            </ButtonLink>
          </aside>
        )}
      </div>
    </main>
  );
}
