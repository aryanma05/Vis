import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCvViewData } from "@/lib/cv-view";
import { getLocale, getT } from "@/lib/i18n/server";
import { showsBranding } from "@/lib/pro";
import { getProfileByUsername } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import EditNav from "../EditNav";
import CvStudio from "./CvStudio";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Rediger CV"), robots: { index: false } };
}

export default async function EditCvPage() {
  const user = await requireUser();
  // Hele profilen, så forhåndsvisningen har kontaktinfo, prosjekter og farge som den ferdige CV-en.
  const [profile, branding, locale] = await Promise.all([getProfileByUsername(user.username, user.id), showsBranding(user.id), getLocale()]);
  if (!profile) notFound();
  const doc = profile.cvDocument;

  return (
    <main className="pb-28 md:pb-16 md:pl-24">
      <EditNav active="cv" username={user.username} />
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <CvStudio
          cv={profile.cv}
          username={user.username}
          template={profile.cvTemplate}
          preview={buildCvViewData(profile, { branding, locale })}
          doc={
            doc && {
              fileUrl: doc.fileUrl,
              fileName: doc.fileName,
              mimeType: doc.mimeType,
              pages: doc.pages.map((p) => ({ url: p.url, width: p.width, height: p.height })),
              isPublic: doc.isPublic,
            }
          }
        />
      </div>
    </main>
  );
}
