"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCommentAction } from "@/app/actions/comments";
import Avatar from "@/components/Avatar";

const MAX = 2000;

export default function CommentForm({
  projectId,
  viewer,
}: {
  projectId: string;
  viewer: { name: string; image: string | null };
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await addCommentAction(projectId, body);
      if (!result.ok) return setError(result.error);
      setBody("");
      router.refresh();
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex gap-4"
    >
      <Avatar name={viewer.name} image={viewer.image} size={36} className="mt-1" />
      <div className="flex-1">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) submit();
          }}
          rows={3}
          maxLength={MAX}
          placeholder="Skriv en kommentar – hva likte du, eller har du et tips?"
          className="w-full resize-y rounded-xl border border-line bg-surface/60 px-4 py-3 text-white outline-none transition placeholder:text-mist/50 focus:border-ice"
        />
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-xs text-mist/60">{body.length > MAX - 200 ? `${MAX - body.length} tegn igjen` : "⌘ + Enter for å sende"}</p>
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="rounded-lg bg-ice px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sender…" : "Kommenter"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    </form>
  );
}
