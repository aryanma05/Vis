import Link from "next/link";
import GithubButton from "@/components/GithubButton";
import ProjectForm from "@/components/ProjectForm";
import { FolderIcon, GithubIcon, ImageIcon } from "@/components/icons";
import { isGithubConfigured } from "@/lib/auth";
import { hasGithubAccount } from "@/lib/github";
import { MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";
import FolderImport from "./FolderImport";
import GithubImporter from "./GithubImporter";

export const metadata = { title: "Del prosjekt – vis" };

// Bilder først: det er det folk ser på.
const SOURCES = [
  { key: "manuell", label: "Last opp bilder", text: "Dra inn bilder og gi prosjektet et navn.", Icon: ImageIcon },
  { key: "mappe", label: "Fra en mappe", text: "Dra inn prosjektmappen fra maskinen din.", Icon: FolderIcon },
  { key: "github", label: "Fra GitHub", text: "Velg blant de offentlige repoene dine.", Icon: GithubIcon },
] as const;

type Source = (typeof SOURCES)[number]["key"];

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ fra?: string }> }) {
  const user = await requireUser();
  const { fra } = await searchParams;
  const source: Source = fra === "github" || fra === "mappe" ? fra : "manuell";
  const githubLinked = source === "github" ? await hasGithubAccount(user.id) : false;

  return (
    <main className="min-h-screen pb-28 md:pb-16 md:pl-28 md:pr-10">
      <div className="mx-auto max-w-5xl px-6 py-14">
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
                className={`rounded-xl border p-4 transition ${active ? "border-primary bg-primary/5" : "border-line hover:border-mist/60"}`}
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
