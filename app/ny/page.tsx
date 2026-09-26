import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, ImagePlus } from "lucide-react";
import { OAuthButton } from "@/components/GithubButton";
import { GithubMark } from "@/components/icons";
import ProjectForm from "@/components/ProjectForm";
import { isGithubConfigured } from "@/lib/auth";
import { hasGithubAccount } from "@/lib/github";
import { getPopularTags, MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";
import FolderImport from "./FolderImport";
import GithubImporter from "./GithubImporter";

export const metadata: Metadata = { title: "Del prosjekt", robots: { index: false } };

// Bilder først: det er det folk ser på.
const SOURCES = [
  { key: "manuell", label: "Med bilder", text: "Dra inn skjermbilder og skriv litt om det.", Icon: ImagePlus },
  { key: "mappe", label: "Fra en mappe", text: "Vi leser README og finner skjermbilder. Koden lastes ikke opp.", Icon: FolderOpen },
  { key: "github", label: "Fra GitHub", text: "Velg blant de offentlige repoene dine.", Icon: GithubMark },
] as const;

type Source = (typeof SOURCES)[number]["key"];

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ fra?: string }> }) {
  const user = await requireUser();
  const { fra } = await searchParams;
  const source: Source = fra === "github" || fra === "mappe" ? fra : "manuell";
  const [githubLinked, tags] = await Promise.all([source === "github" ? hasGithubAccount(user.id) : false, getPopularTags(40)]);

  return (
    <main className="px-5 pb-28 pt-8 md:pb-16 md:pl-28 md:pr-10 md:pt-12">
      <div className="mx-auto max-w-5xl">
        <p className="label-mono">Nytt prosjekt</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
          Hva vil du <span className="serif-accent font-normal text-ice">vise frem</span>?
        </h1>

        <nav aria-label="Hvor prosjektet kommer fra" className="mt-10 grid gap-3 sm:grid-cols-3">
          {SOURCES.map(({ key, label, text, Icon }) => {
            const active = key === source;
            return (
              <Link
                key={key}
                href={`/ny?fra=${key}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`group rounded-2xl border p-4 transition ${active ? "border-ice/60 bg-ice/[0.06]" : "border-line hover:border-mist/50 hover:bg-surface/50"}`}
              >
                <span className={`flex size-10 items-center justify-center rounded-xl border ${active ? "border-ice/40 bg-ice/10 text-ice" : "border-line text-mist group-hover:text-fg"}`}>
                  <Icon className="size-5" />
                </span>
                <p className="mt-3 font-semibold">{label}</p>
                <p className="mt-1 text-sm leading-5 text-mist">{text}</p>
              </Link>
            );
          })}
        </nav>

        <div className="mt-12">
          {source === "mappe" && <FolderImport />}
          {source === "github" &&
            (githubLinked ? (
              <GithubImporter />
            ) : isGithubConfigured ? (
              <div className="max-w-sm space-y-4 rounded-3xl border border-line p-6">
                <p className="text-mist">Koble til GitHub for å velge hvilke repoer du vil vise frem. Vi ber bare om tilgang til offentlige repoer.</p>
                <OAuthButton provider="github" mode="link" callbackURL="/ny?fra=github" label="Koble til GitHub" />
              </div>
            ) : (
              <p className="text-mist">GitHub-innlogging er ikke satt opp ennå (GITHUB_CLIENT_ID mangler).</p>
            ))}
          {source === "manuell" && <ProjectForm maxImages={MAX_PROJECT_IMAGES} tagSuggestions={tags.map((t) => t.name)} />}
        </div>
      </div>
    </main>
  );
}
