import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Hash } from "lucide-react";
import Avatar from "@/components/Avatar";
import ProjectMasonry from "@/components/ProjectMasonry";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Tag } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { getT } from "@/lib/i18n/server";
import { getRelatedTags, getTagBySlug, getTopCreatorsForTag, searchProjects } from "@/lib/projects";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [tag, t] = await Promise.all([getTagBySlug(decodeURIComponent((await params).slug)), getT()]);
  if (!tag) return { title: t("Fant ikke teknologien"), robots: { index: false } };
  return {
    title: t("{name}-prosjekter", { name: tag.name }),
    description: t("Prosjekter laget med {name} av utviklere og designere i Norden, og folkene bak dem.", { name: tag.name }),
    alternates: { canonical: `/tag/${tag.slug}` },
  };
}

// Egen side per teknologi: prosjektene, folkene som bruker den mest og beslektede teknologier.
export default async function TagPage({ params, searchParams }: Props) {
  const [{ slug }, { sort }, t] = await Promise.all([params, searchParams, getT()]);
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
            <Hash className="size-3.5" /> {t("Teknologi")}
          </p>
          <h1 className="mt-2 display text-[clamp(2.5rem,6vw,4.5rem)]">{tag.name}</h1>
          <p className="mt-3 text-lg text-mist">
            {t("{projects} fra {people} på Vis.", {
              projects: projects.length === 1 ? t("1 prosjekt") : t("{n} prosjekter", { n: projects.length }),
              people: creators.length === 1 ? t("1 person") : t("{n} personer", { n: creators.length }),
            })}
          </p>
          {related.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-mist">{t("Ofte sammen med")}</span>
              {related.map((r) => (
                <Tag key={r.slug} href={`/tag/${r.slug}`} count={r.count}>
                  {r.name}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-8 md:px-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <Tabs
            label={t("Sortering")}
            className="mb-8"
            active={order}
            items={[
              { key: "newest", label: t("Nyeste"), href: `/tag/${tag.slug}` },
              { key: "trending", label: t("Populært"), href: `/tag/${tag.slug}?sort=trending` },
              { key: "popular", label: t("Mest likt"), href: `/tag/${tag.slug}?sort=popular` },
            ]}
          />
          {projects.length > 0 ? (
            <ProjectMasonry projects={projects} columns={2} />
          ) : (
            <EmptyState
              title={t("Ingen publiserte prosjekter med {name} ennå", { name: tag.name })}
              action={<ButtonLink href="/ny">{t("Del et prosjekt")}</ButtonLink>}
            />
          )}
        </section>

        {creators.length > 0 && (
          <aside className="xl:sticky xl:top-8 xl:self-start">
            <h2 className="caption">{t("Folk som bruker {name}", { name: tag.name })}</h2>
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
              {t("Finn flere")} <ArrowRight className="size-4" />
            </ButtonLink>
          </aside>
        )}
      </div>
    </main>
  );
}
