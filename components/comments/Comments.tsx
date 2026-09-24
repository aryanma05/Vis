import Link from "next/link";
import { MessageCircle } from "lucide-react";
import CommentForm from "@/components/comments/CommentForm";
import CommentItem from "@/components/comments/CommentItem";
import { existingUsernames, listComments, type ProjectComment } from "@/lib/comments";
import type { CurrentUser } from "@/lib/session";

const countAll = (list: ProjectComment[]): number => list.reduce((n, c) => n + 1 + countAll(c.replies), 0);
const allBodies = (list: ProjectComment[]): string[] => list.flatMap((c) => [c.body, ...allBodies(c.replies)]);

export default async function Comments({
  projectId,
  viewer,
  isAdmin = false,
}: {
  projectId: string;
  viewer: CurrentUser | null;
  isAdmin?: boolean;
}) {
  const comments = await listComments(projectId, viewer?.id, { isAdmin });
  const known = await existingUsernames(allBodies(comments));
  const total = countAll(comments);
  const me = viewer ? { id: viewer.id, name: viewer.name, image: viewer.image ?? null } : null;

  return (
    <section id="kommentarer" className="scroll-mt-24" aria-label="Kommentarer">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Kommentarer</h2>
        <span className="font-mono text-xs text-mist">{total}</span>
      </div>

      <div className="mt-6">
        {me ? (
          <CommentForm projectId={projectId} viewer={me} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-line px-5 py-4">
            <p className="text-mist">Logg inn for å kommentere og svare.</p>
            <Link href={`/logg-inn?neste=/prosjekt/${projectId}%23kommentarer`} className="text-sm font-semibold text-ice hover:underline">
              Logg inn
            </Link>
          </div>
        )}
      </div>

      {comments.length > 0 ? (
        <ul className="mt-10 space-y-8">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} projectId={projectId} viewer={me} known={known} />
          ))}
        </ul>
      ) : (
        <div className="mt-10 flex items-center gap-3 text-mist">
          <MessageCircle className="size-5" aria-hidden="true" />
          <p>Ingen kommentarer ennå. Bli den første som sier noe hyggelig eller stiller et spørsmål.</p>
        </div>
      )}
    </section>
  );
}
