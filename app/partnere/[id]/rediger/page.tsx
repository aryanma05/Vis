import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PartnerPostForm from "@/components/partners/PartnerPostForm";
import { getT } from "@/lib/i18n/server";
import { getPartnerPost, listOwnProjectsForPicker } from "@/lib/partner-posts";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Rediger"), robots: { index: false } };
}

export default async function EditPartnerPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [post, projects, t] = await Promise.all([getPartnerPost(id, user.id), listOwnProjectsForPicker(user.id), getT()]);
  if (!post?.isOwner) notFound();

  return (
    <main className="px-5 pb-28 pt-8 md:pb-16 md:pl-28 md:pr-10 md:pt-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/partnere/${post.id}`} className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {post.title}
        </Link>
        <h1 className="mt-4 display text-[34px] md:text-5xl">{t("Rediger")}</h1>
        <div className="mt-8 rounded-[26px] glass-card p-6 md:p-8">
          <PartnerPostForm
            postId={post.id}
            projects={projects}
            initial={{
              title: post.title,
              description: post.description,
              stage: post.stage,
              projectId: post.linkedProjectId ?? "",
              needs: post.needs,
              commitments: post.commitments,
            }}
          />
        </div>
      </div>
    </main>
  );
}
