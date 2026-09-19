import SiteHeader from "@/components/SiteHeader";
import { getCv } from "@/lib/cv";
import { getCvDocument } from "@/lib/cv-document";
import { requireUser } from "@/lib/session";
import EditNav from "../EditNav";
import CvStudio from "./CvStudio";

export const metadata = { title: "Rediger CV – vis" };

export default async function EditCvPage() {
  const user = await requireUser();
  const [cv, doc] = await Promise.all([getCv(user.id), getCvDocument(user.id, user.id)]);

  return (
    <main className="min-h-screen bg-ink text-white">
      <SiteHeader />
      <EditNav active="cv" username={user.username} />
      <div className="mx-auto max-w-5xl px-6">
        <CvStudio
          cv={cv}
          username={user.username}
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
