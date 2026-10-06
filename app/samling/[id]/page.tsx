import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, Globe2, Lock } from "lucide-react";
import Avatar from "@/components/Avatar";
import ProjectCard from "@/components/ProjectCard";
import { CollectionOwnerTools, RemoveFromCollection } from "@/components/project/CollectionTools";
import ShareMenu from "@/components/social/ShareMenu";
import { EmptyState } from "@/components/ui/misc";
import { getCollection } from "@/lib/collections";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, t] = await Promise.all([params, getT()]);
  const collection = await getCollection(id, (await getCurrentUser())?.id);
  if (!collection) return { title: t("Fant ikke samlingen") };
  return {
    title: t("{title} – samling av {name}", { title: collection.title, name: collection.owner.name }),
    description: collection.description ?? t("{n} prosjekter samlet av {name} på Vis.", { n: collection.projects.length, name: collection.owner.name }),
    robots: collection.isPublic ? undefined : { index: false },
  };
}

export default async function CollectionPage({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getT()]);
  const viewer = await getCurrentUser();
  const collection = await getCollection(id, viewer?.id);
  if (!collection) notFound();

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <p className="caption inline-flex items-center gap-2">
          {collection.isPublic ? <Globe2 className="size-3.5" /> : <Lock className="size-3.5" />}
          {collection.isPublic ? t("Samling") : t("Privat samling")}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display text-[clamp(2.2rem,5vw,3.6rem)]">{collection.title}</h1>
            {collection.description && <p className="mt-3 max-w-2xl text-lg leading-8 text-mist">{collection.description}</p>}
            <Link href={`/@${collection.owner.username}`} className="mt-4 inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
              <Avatar name={collection.owner.name} image={collection.owner.image} size={24} />
              {collection.owner.name} ·{" "}
              {collection.projects.length === 1 ? t("1 prosjekt") : t("{n} prosjekter", { n: collection.projects.length })}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {collection.isPublic && <ShareMenu path={`/samling/${collection.id}`} title={collection.title} kind="cv" />}
            {collection.isOwner && (
              <CollectionOwnerTools
                id={collection.id}
                initial={{ title: collection.title, description: collection.description, isPublic: collection.isPublic }}
              />
            )}
          </div>
        </div>

        {collection.projects.length === 0 ? (
          <EmptyState className="mt-12" icon={<Bookmark className="size-5" />} title={t("Tom samling")}>
            {collection.isOwner ? t("Trykk på bokmerket på et prosjekt for å lagre det her.") : t("Ingen prosjekter her ennå.")}
          </EmptyState>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
            {collection.projects.map((p, i) => (
              <div key={p.id}>
                <ProjectCard project={p} priority={i < 3} />
                {collection.isOwner && <RemoveFromCollection collectionId={collection.id} projectId={p.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
