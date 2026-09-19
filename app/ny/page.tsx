import Link from "next/link";
import GithubButton from "@/components/GithubButton";
import ProjectForm from "@/components/ProjectForm";
import SiteHeader from "@/components/SiteHeader";
import { FolderIcon, GithubIcon, PencilIcon } from "@/components/icons";
import { isGithubConfigured } from "@/lib/auth";
import { hasGithubAccount } from "@/lib/github";
import { MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";
import FolderImport from "./FolderImport";
import GithubImporter from "./GithubImporter";

export const metadata = { title: "Del prosjekt – vis" };

const SOURCES = [
  { key: "mappe", label: "Fra en mappe", text: "Dra inn prosjektmappen fra maskinen din.", Icon: FolderIcon },
  { key: "github", label: "Fra GitHub", text: "Velg blant de offentlige repoene dine.", Icon: GithubIcon },
  { key: "manuell", label: "Skriv selv", text: "Fyll inn tittel, beskrivelse og bilder.", Icon: PencilIcon },
] as const;

type Source = (typeof SOURCES)[number]["key"];

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ fra?: string }> }) {
  const user = await requireUser();
  const { fra } = await searchParams;
  const source: Source = fra === "github" || fra === "manuell" ? fra : "mappe";
  const githubLinked = source === "github" ? await hasGithubAccount(user.id) : false;

  return (
    <main className="min-h-screen bg-ink text-white">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-6 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Nytt prosjekt</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Hva vil du vise frem?</h1>

        <nav className="mt-10 grid gap-3 sm:grid-cols-3">
          {SOURCES.map(({ key, label, text, Icon }) => {
            const active = key === source;
            return (
              <Link
                key={key}
                href={`/ny?fra=${key}`}
                scroll={false}
                aria-current={active}
                className={`rounded-xl border p-4 transition ${active ? "border-ice bg-ice/5" : "border-line hover:border-mist/60"}`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-ice" : "text-mist"}`} />
                <p className="mt-3 font-medium">{label}</p>
                <p className="mt-1 text-sm text-mist/80">{text}</p>
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
              <div className="max-w-sm space-y-3">
                <p className="text-mist">Koble til GitHub for å velge hvilke repoer du vil vise frem.</p>
                <GithubButton mode="link" callbackURL="/ny?fra=github" label="Koble til GitHub" />
              </div>
            ) : (
              <p className="text-mist">GitHub-innlogging er ikke satt opp ennå (GITHUB_CLIENT_ID mangler).</p>
            ))}
          {source === "manuell" && <ProjectForm maxImages={MAX_PROJECT_IMAGES} />}
        </div>
      </div>
    </main>
  );
}
