import type { Metadata } from "next";
import ProjectForm from "@/components/ProjectForm";
import { Tabs } from "@/components/ui/tabs";
import { isGithubConfigured } from "@/lib/auth";
import { githubLoginFromLinks, hasGithubAccount } from "@/lib/github";
import { getOwnProfile } from "@/lib/profiles";
import { getPopularTags, MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";
import FolderImport from "./FolderImport";
import GithubImporter from "./GithubImporter";

export const metadata: Metadata = { title: "Del prosjekt", robots: { index: false } };

// Skjermbildene av en nettside kan ta litt tid å lage.
export const maxDuration = 60;

const SOURCES = [
  { key: "manuell", label: "Lenke og bilder", text: "Lim inn lenken til prosjektet, så tar vi skjermbilder. Eller dra inn egne bilder." },
  { key: "mappe", label: "Fra en mappe", text: "Vi leser README og finner skjermbilder. Koden lastes ikke opp." },
  { key: "github", label: "Fra GitHub", text: "Skriv brukernavnet ditt eller lim inn en repo-lenke." },
] as const;

type Source = (typeof SOURCES)[number]["key"];

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ fra?: string }> }) {
  const user = await requireUser();
  const { fra } = await searchParams;
  const source: Source = fra === "github" || fra === "mappe" ? fra : "manuell";
  const [githubLinked, ownProfile, tags] = await Promise.all([
    source === "github" ? hasGithubAccount(user.id) : false,
    source === "github" ? getOwnProfile(user.id) : null,
    getPopularTags(40),
  ]);
  const current = SOURCES.find((s) => s.key === source)!;

  return (
    <main className="px-5 pb-28 pt-6 md:pb-16 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <h1 className="display text-[34px] md:text-5xl">Nytt prosjekt</h1>

        <div className="mt-6">
          <Tabs
            label="Hvor prosjektet kommer fra"
            active={source}
            items={SOURCES.map((s) => ({ key: s.key, label: s.label, href: `/ny?fra=${s.key}` }))}
          />
          <p className="mt-3 text-sm text-mist">{current.text}</p>
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
          {source === "manuell" && <ProjectForm maxImages={MAX_PROJECT_IMAGES} tagSuggestions={tags.map((t) => t.name)} />}
        </div>
      </div>
    </main>
  );
}
