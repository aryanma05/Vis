import SiteHeader from "@/components/SiteHeader";
import ProjectForm from "@/components/ProjectForm";
import { MAX_PROJECT_IMAGES } from "@/lib/projects";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Nytt prosjekt – vis" };

export default async function NewProjectPage() {
  await requireUser();

  return (
    <main className="min-h-screen bg-[#071A52] text-white">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Nytt prosjekt</h1>
        <p className="mt-2 text-[#B8D8E3]">Har du koden på GitHub? Da kan du importere den i stedet.</p>
        <div className="mt-8">
          <ProjectForm maxImages={MAX_PROJECT_IMAGES} />
        </div>
      </section>
    </main>
  );
}
