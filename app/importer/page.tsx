import SiteHeader from "@/components/SiteHeader";
import GithubButton from "@/components/GithubButton";
import { ui } from "@/components/ui";
import { isGithubConfigured } from "@/lib/auth";
import { getCv } from "@/lib/cv";
import { hasGithubAccount } from "@/lib/github";
import { requireUser } from "@/lib/session";
import CvImporter from "./CvImporter";
import GithubImporter from "./GithubImporter";

export const metadata = { title: "Importer – vis" };

export default async function ImportPage() {
  const user = await requireUser();
  const [githubLinked, cv] = await Promise.all([hasGithubAccount(user.id), getCv(user.id)]);
  const hasCv = cv.experience.length > 0 || cv.education.length > 0 || cv.skills.length > 0;

  return (
    <main className="min-h-screen bg-[#071A52] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
        <section className={ui.card}>
          <p className="text-sm font-medium uppercase tracking-widest text-[#C7F9FF]">Prosjekter</p>
          <h1 className="mt-2 text-2xl font-bold">Importer fra GitHub</h1>
          <div className="mt-6">
            {githubLinked ? (
              <GithubImporter />
            ) : isGithubConfigured ? (
              <div className="space-y-3">
                <p className="text-[#B8D8E3]">Koble til GitHub for å velge hvilke repoer du vil vise frem.</p>
                <GithubButton mode="link" callbackURL="/importer" label="Koble til GitHub" />
              </div>
            ) : (
              <p className="text-[#B8D8E3]">GitHub-innlogging er ikke satt opp ennå (GITHUB_CLIENT_ID mangler).</p>
            )}
          </div>
        </section>

        <section id="cv" className={ui.card}>
          <p className="text-sm font-medium uppercase tracking-widest text-[#C7F9FF]">CV</p>
          <h2 className="mt-2 text-2xl font-bold">Importer CV</h2>
          <p className="mt-2 text-[#B8D8E3]">Vi leser erfaring, utdanning og ferdigheter fra CV-en din og fyller ut profilen.</p>
          <div className="mt-6">
            <CvImporter username={user.username} hasCv={hasCv} />
          </div>
        </section>
      </div>
    </main>
  );
}
