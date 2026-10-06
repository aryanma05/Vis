import type { Metadata } from "next";
import { getCv } from "@/lib/cv";
import { getCvDocument } from "@/lib/cv-document";
import { getT } from "@/lib/i18n/server";
import { getOwnProfile } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import EditNav from "../EditNav";
import CvStudio from "./CvStudio";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Rediger CV"), robots: { index: false } };
}

export default async function EditCvPage() {
  const user = await requireUser();
  const [cv, doc, profile] = await Promise.all([getCv(user.id), getCvDocument(user.id, user.id), getOwnProfile(user.id)]);

  return (
    <main className="pb-28 md:pb-16 md:pl-24">
      <EditNav active="cv" username={user.username} />
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <CvStudio
          cv={cv}
          username={user.username}
          template={profile?.cvTemplate ?? "klassisk"}
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
