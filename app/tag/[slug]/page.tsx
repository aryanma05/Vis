import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Hash } from "lucide-react";
import Avatar from "@/components/Avatar";
import ProjectMasonry from "@/components/ProjectMasonry";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Tag } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
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
      <header>
        <div className="mx-auto max-w-7xl px-5 pb-4 pt-8 md:px-10 md:pt-14">
          <p className="caption inline-flex items-center gap-1.5">
            <Hash className="size-3.5" /> Teknologi
          </p>
          <h1 className="mt-2 display text-[clamp(2.5rem,6vw,4.5rem)]">{tag.name}</h1>
          <p className="mt-3 text-lg text-mist">
            {projects.length} {projects.length === 1 ? "prosjekt" : "prosjekter"} fra {creators.length}{" "}
            {creators.length === 1 ? "person" : "personer"} på Vis.
          </p>
          {related.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
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

      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-8 md:px-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <Tabs
            label="Sortering"
            className="mb-8"
            active={order}
            items={[
              { key: "newest", label: "Nyeste", href: `/tag/${tag.slug}` },
              { key: "trending", label: "Populært", href: `/tag/${tag.slug}?sort=trending` },
              { key: "popular", label: "Mest likt", href: `/tag/${tag.slug}?sort=popular` },
            ]}
          />
          {projects.length > 0 ? (
            <ProjectMasonry projects={projects} columns={2} />
          ) : (
            <EmptyState title={`Ingen publiserte prosjekter med ${tag.name} ennå`} action={<ButtonLink href="/ny">Del et prosjekt</ButtonLink>} />
          )}
        </section>

        {creators.length > 0 && (
          <aside className="xl:sticky xl:top-8 xl:self-start">
            <h2 className="caption">Folk som bruker {tag.name}</h2>
            <ul className="mt-5 space-y-4">
              {creators.map((c) => (
                <li key={c.id}>
                  <Link href={`/@${c.username}`} className="group flex items-center gap-3">
                    <Avatar name={c.name} image={c.image} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-[13px] text-mist">{c.headline ?? `@${c.username}`}</span>
                    </span>
                    <span className="text-xs tabular-nums text-mist">{c.count}</span>
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
