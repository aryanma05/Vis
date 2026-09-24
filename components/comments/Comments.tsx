import Link from "next/link";
import CommentForm from "@/components/comments/CommentForm";
import CommentItem from "@/components/comments/CommentItem";
import { listComments } from "@/lib/comments";
import type { CurrentUser } from "@/lib/session";

export default async function Comments({
  projectId,
  ownerId,
  viewer,
}: {
  projectId: string;
  ownerId: string;
  viewer: CurrentUser | null;
}) {
  const comments = await listComments(projectId, viewer?.id);

  return (
    <section id="kommentarer" className="scroll-mt-24">
      <div className="flex items-baseline justify-between border-b border-line pb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Kommentarer</h2>
        <span className="font-mono text-xs text-mist/70">{comments.length}</span>
      </div>

      {comments.length > 0 ? (
        <ul className="divide-y divide-line">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} isProjectOwner={c.author.id === ownerId} />
          ))}
        </ul>
      ) : (
        <p className="py-8 text-mist">Ingen kommentarer ennå. Si gjerne hva du synes!</p>
      )}

      <div className="mt-4 border-t border-line pt-8">
        {viewer ? (
          <CommentForm projectId={projectId} viewer={{ name: viewer.name, image: viewer.image ?? null }} />
        ) : (
          <p className="text-mist">
            <Link href="/logg-inn" className="font-medium text-fg underline underline-offset-4">
              Logg inn
            </Link>{" "}
            for å kommentere.
          </p>
        )}
      </div>
    </section>
  );
}
