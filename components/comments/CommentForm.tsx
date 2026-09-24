"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addCommentAction } from "@/app/actions/comments";
import { quickSearchAction } from "@/app/actions/search";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const MAX = 2000;
type Person = { username: string; name: string; image: string | null; headline: string | null };

// Skriv en kommentar eller et svar. Skriver man @ foreslås personer å nevne.
export default function CommentForm({
  projectId,
  viewer,
  parentId,
  initialText = "",
  autoFocus = false,
  onDone,
  compact = false,
}: {
  projectId: string;
  viewer: { name: string; image: string | null };
  parentId?: string;
  initialText?: string;
  autoFocus?: boolean;
  onDone?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);

  // Høyden følger teksten.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [body]);

  useEffect(() => {
    if (!mention || mention.query.length < 1) {
      setPeople([]);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await quickSearchAction(mention.query);
      setPeople(result.people);
      setActive(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [mention]);

  function detectMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const match = /(^|[\s(])@([a-zA-Z0-9._-]{0,39})$/.exec(before);
    setMention(match ? { query: match[2], start: caret - match[2].length - 1 } : null);
  }

  function pick(person: Person) {
    if (!mention) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? body.length;
    const next = `${body.slice(0, mention.start)}@${person.username} ${body.slice(caret)}`;
    setBody(next);
    setMention(null);
    setPeople([]);
    requestAnimationFrame(() => {
      const pos = mention.start + person.username.length + 2;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await addCommentAction(projectId, body, parentId ?? null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      onDone?.();
      toast.success(parentId ? "Svaret er publisert" : "Kommentaren er publisert");
      router.refresh();
    });

  const showPeople = mention && people.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) submit();
      }}
      className="flex gap-3.5"
    >
      <Avatar name={viewer.name} image={viewer.image} size={compact ? 30 : 38} className="mt-1" />
      <div className="relative min-w-0 flex-1">
        <div className="rounded-2xl border border-line bg-ink-2/50 transition focus-within:border-ice/60 focus-within:ring-4 focus-within:ring-ice/10">
          <textarea
            ref={ref}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              detectMention(e.target.value, e.target.selectionStart);
            }}
            onClick={(e) => detectMention(body, e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (showPeople) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => (i + 1) % people.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => (i - 1 + people.length) % people.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  pick(people[active]);
                  return;
                }
                if (e.key === "Escape") {
                  setMention(null);
                  return;
                }
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape" && onDone) onDone();
            }}
            rows={compact ? 2 : 3}
            maxLength={MAX}
            placeholder={parentId ? "Skriv et svar …" : "Hva synes du? Still et spørsmål eller gi et tips. Skriv @ for å nevne noen."}
            aria-label={parentId ? "Svar" : "Kommentar"}
            className="block w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-6 text-fg outline-none placeholder:text-mist/50"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line/60 px-3 py-2">
            <p className="text-xs text-mist/70">{body.length > MAX - 200 ? `${MAX - body.length} tegn igjen` : "⌘ + Enter for å sende"}</p>
            <div className="flex gap-2">
              {onDone && (
                <Button type="button" variant="ghost" size="xs" onClick={onDone}>
                  Avbryt
                </Button>
              )}
              <Button type="submit" size="xs" loading={pending} disabled={!body.trim()}>
                {parentId ? "Svar" : "Kommenter"}
              </Button>
            </div>
          </div>
        </div>

        {showPeople && (
          <ul role="listbox" aria-label="Nevn en person" className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)] sm:right-auto sm:w-80">
            {people.map((p, i) => (
              <li key={p.username}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm ${i === active ? "bg-surface-2" : ""}`}
                >
                  <Avatar name={p.name} image={p.image} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg">{p.name}</span>
                    <span className="block truncate text-xs text-mist">@{p.username}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </form>
  );
}
