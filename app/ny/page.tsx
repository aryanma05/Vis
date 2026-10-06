import type { Metadata } from "next";
import { FolderOpen, Link2 } from "lucide-react";
import { GithubMark } from "@/components/icons";
import ProjectForm from "@/components/ProjectForm";
import { Tabs } from "@/components/ui/tabs";
import { isGithubConfigured } from "@/lib/auth";
import { githubLoginFromLinks, hasGithubAccount } from "@/lib/github";
import { getT } from "@/lib/i18n/server";
import { getOwnProfile } from "@/lib/profiles";
import { getPopularTags, MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";
import FolderImport from "./FolderImport";
import GithubImporter from "./GithubImporter";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Del prosjekt"), robots: { index: false } };
}

// Skjermbildene av en nettside kan ta litt tid å lage.
export const maxDuration = 60;

const SOURCES = [
  { key: "manuell", label: "Lenke og bilder", Icon: Link2 },
  { key: "mappe", label: "Fra en mappe", Icon: FolderOpen },
  { key: "github", label: "Fra GitHub", Icon: GithubMark },
] as const;

type Source = (typeof SOURCES)[number]["key"];

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ fra?: string }> }) {
  const user = await requireUser();
  const { fra } = await searchParams;
  const source: Source = fra === "github" || fra === "mappe" ? fra : "manuell";
  const [githubLinked, ownProfile, tags, t] = await Promise.all([
    source === "github" ? hasGithubAccount(user.id) : false,
    source === "github" ? getOwnProfile(user.id) : null,
    getPopularTags(40),
    getT(),
  ]);

  return (
    <main className="px-5 pb-28 pt-6 md:pb-16 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <h1 className="display text-[34px] md:text-5xl">{t("Nytt prosjekt")}</h1>

        <div className="mt-6">
          <Tabs
            label={t("Hvor prosjektet kommer fra")}
            active={source}
            items={SOURCES.map(({ key, label, Icon }) => ({
              key,
              label: (
                <>
                  <Icon className="size-4" aria-hidden="true" /> {t(label)}
                </>
              ),
              href: `/ny?fra=${key}`,
            }))}
          />
        </div>

        <div className="mt-10">
          {source === "mappe" && <FolderImport maxImages={MAX_PROJECT_IMAGES} />}
          {source === "github" && (
            <GithubImporter
              linked={githubLinked}
              canLink={isGithubConfigured}
              suggestedLogin={githubLoginFromLinks(ownProfile?.links ?? [])}
            />
          )}
          {source === "manuell" && <ProjectForm maxImages={MAX_PROJECT_IMAGES} tagSuggestions={tags.map((tag) => tag.name)} selfUsername={user.username} />}
        </div>
      </div>
    </main>
  );
}
