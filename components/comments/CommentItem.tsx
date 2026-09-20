"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCommentAction, editCommentAction } from "@/app/actions/comments";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/format";
import type { ProjectComment } from "@/lib/comments";

export default function CommentItem({ comment, isProjectOwner }: { comment: ProjectComment; isProjectOwner: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await editCommentAction(comment.id, body);
      if (!result.ok) return setError(result.error);
      setEditing(false);
      setError(null);
      router.refresh();
    });

  const remove = () => {
    if (!confirm("Slette kommentaren?")) return;
    startTransition(async () => {
      const result = await deleteCommentAction(comment.id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  };

  return (
    <li className="flex gap-4 py-6">
      <Link href={`/@${comment.author.username}`} className="mt-0.5">
        <Avatar name={comment.author.name} image={comment.author.image} size={36} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <Link href={`/@${comment.author.username}`} className="font-medium text-fg hover:text-ice">
            {comment.author.name}
          </Link>
          {isProjectOwner && (
            <span className="rounded border border-line px-1.5 font-mono text-[10px] uppercase tracking-wider text-mist">
              Skaper
            </span>
          )}
          <time dateTime={new Date(comment.createdAt).toISOString()} className="text-mist/60">
            {timeAgo(comment.createdAt)}
            {comment.editedAt && " · redigert"}
          </time>
        </div>

        {editing ? (
          <div className="mt-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-xl border border-line bg-surface/60 px-4 py-3 text-fg outline-none focus:border-primary"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending || !body.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-50"
              >
                Lagre
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setBody(comment.body);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-mist hover:text-fg"
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 whitespace-pre-line break-words leading-7 text-mist">{comment.body}</p>
        )}

        {!editing && (comment.canEdit || comment.canDelete) && (
          <div className="mt-2 flex gap-4 text-xs text-mist/60">
            {comment.canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="hover:text-fg">
                Rediger
              </button>
            )}
            {comment.canDelete && (
              <button type="button" onClick={remove} disabled={pending} className="hover:text-red-300">
                Slett
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    </li>
  );
}
