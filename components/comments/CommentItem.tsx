"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Flag, MoreHorizontal, PenLine, Reply, Trash2 } from "lucide-react";
import { deleteCommentAction, editCommentAction } from "@/app/actions/comments";
import Avatar from "@/components/Avatar";
import CommentForm from "@/components/comments/CommentForm";
import ReportDialog from "@/components/moderation/ReportDialog";
import RichText from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/format";
import type { ProjectComment } from "@/lib/comments";

export default function CommentItem({
  comment,
  projectId,
  viewer,
  known,
  isReply = false,
}: {
  comment: ProjectComment;
  projectId: string;
  viewer: { id: string; name: string; image: string | null } | null;
  known: string[];
  isReply?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await editCommentAction(comment.id, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      router.refresh();
    });

  const remove = () => {
    if (!confirm(comment.replies.length > 0 ? "Slette kommentaren og svarene på den?" : "Slette kommentaren?")) return;
    startTransition(async () => {
      const result = await deleteCommentAction(comment.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Kommentaren er slettet");
      router.refresh();
    });
  };

  const canReport = viewer && viewer.id !== comment.author.id;
  const hasMenu = comment.canEdit || comment.canDelete || canReport;

  return (
    <li id={`kommentar-${comment.id}`} className="scroll-mt-28">
      <div className="group flex gap-3.5 rounded-2xl transition target:bg-ice/5">
        <Link href={`/@${comment.author.username}`} className="mt-0.5 shrink-0">
          <Avatar name={comment.author.name} image={comment.author.image} size={isReply ? 30 : 38} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <Link href={`/@${comment.author.username}`} className="font-semibold text-fg hover:text-ice">
              {comment.author.name}
            </Link>
            {comment.isProjectOwner && (
              <span className="rounded-md border border-ice/40 bg-ice/10 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ice">Skaper</span>
            )}
            <time dateTime={new Date(comment.createdAt).toISOString()} suppressHydrationWarning className="text-mist/70">
              {timeAgo(comment.createdAt)}
              {comment.editedAt && " · redigert"}
            </time>
            {hasMenu && !editing && (
              <div className="ml-auto opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <Menu
                  label="Kommentarvalg"
                  align="end"
                  className="min-w-44"
                  trigger={({ open, toggle }) => (
                    <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label="Valg for kommentaren" className="rounded-lg p-1 text-mist hover:bg-surface hover:text-fg">
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}
                >
                  {comment.canEdit && (
                    <MenuItem icon={<PenLine className="size-4" />} onSelect={() => setEditing(true)}>
                      Rediger
                    </MenuItem>
                  )}
                  {comment.canDelete && (
                    <MenuItem icon={<Trash2 className="size-4" />} onSelect={remove} danger>
                      Slett
                    </MenuItem>
                  )}
                  {canReport && (
                    <MenuItem icon={<Flag className="size-4" />} onSelect={() => setReporting(true)} danger>
                      Rapporter
                    </MenuItem>
                  )}
                </Menu>
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-2xl border border-line bg-ink-2/50 px-4 py-3 text-[15px] text-fg outline-none focus:border-ice/60"
              />
              <div className="mt-2 flex gap-2">
                <Button size="xs" onClick={save} loading={pending} disabled={!body.trim()}>
                  Lagre
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setBody(comment.body);
                  }}
                >
                  Avbryt
                </Button>
              </div>
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </div>
          ) : (
            <RichText text={comment.body} known={known} className="mt-1 text-[15px] leading-7 text-fg/90" />
          )}

          {!editing && viewer && (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-mist transition hover:text-fg"
            >
              <Reply className="size-3.5" /> Svar
            </button>
          )}

          {replying && viewer && (
            <div className="mt-3">
              <CommentForm
                projectId={projectId}
                viewer={viewer}
                parentId={comment.parentId ?? comment.id}
                initialText={`@${comment.author.username} `}
                autoFocus
                compact
                onDone={() => setReplying(false)}
              />
            </div>
          )}

          {comment.replies.length > 0 && (
            <ul className="mt-5 space-y-5 border-l border-line pl-4 md:pl-5">
              {comment.replies.map((r) => (
                <CommentItem key={r.id} comment={r} projectId={projectId} viewer={viewer} known={known} isReply />
              ))}
            </ul>
          )}
        </div>
      </div>
      {canReport && <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={comment.id} loggedIn />}
    </li>
  );
}
