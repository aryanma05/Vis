import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CvToolbar from "@/components/cv/CvToolbar";
import CvView from "@/components/cv/CvView";
import { CV_TEMPLATES, type CvTemplate } from "@/lib/constants";
import { buildCvViewData } from "@/lib/cv-view";
import { getProfileBase, getProfileByUsername } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ mal?: string; skriv?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfileBase(decodeURIComponent((await params).username));
  if (!profile) return { title: "Fant ikke CV-en", robots: { index: false } };
  return {
    title: `CV – ${profile.name}`,
    description: profile.headline ?? `CV-en til ${profile.name} på Vis.`,
    alternates: { canonical: `/@${profile.username}/cv` },
  };
}

// Den delbare nett-CV-en. Samme side brukes til utskrift og «Lagre som PDF».
export default async function CvPage({ params, searchParams }: Props) {
  const [{ username }, { mal, skriv }] = await Promise.all([params, searchParams]);
  const viewer = await getCurrentUser();
  const profile = await getProfileByUsername(decodeURIComponent(username), viewer?.id);
  if (!profile) notFound();

  const template: CvTemplate = CV_TEMPLATES.includes(mal as CvTemplate) ? (mal as CvTemplate) : profile.cvTemplate;

  return (
    <main className="px-3 pb-28 pt-8 sm:px-5 md:pb-20 md:pl-28 md:pr-10 md:pt-12 print:p-0">
      <div className="mx-auto max-w-[820px]">
        <CvToolbar
          username={profile.username}
          name={profile.name}
          template={template}
          savedTemplate={profile.cvTemplate}
          isOwner={profile.isOwner}
          autoPrint={skriv === "1"}
        />
        <div className="mt-8 print:mt-0">
          <CvView data={buildCvViewData(profile)} template={template} />
        </div>
        <p className="mt-6 text-center text-xs text-mist print:hidden">
          Tips: I utskriftsvinduet, slå av «Topptekst og bunntekst» for en ren PDF.
        </p>
      </div>
    </main>
  );
}
