"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { MAX_TAGS_PER_PROJECT, normalizeTagNames, tagSlug } from "@/lib/tag-names";

// Teknologier som merker. Enter eller komma legger til, og populære teknologier foreslås
// mens man skriver. Verdien sendes som kommaseparert tekst i et skjult felt.
export default function TagInput({
  name,
  defaultValue = [],
  suggestions = [],
  id,
}: {
  name: string;
  defaultValue?: string[];
  suggestions?: string[];
  id?: string;
}) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = tagSlug(draft);
    const taken = new Set(tags.map(tagSlug));
    const pool = suggestions.filter((s) => !taken.has(tagSlug(s)));
    if (!q) return pool.slice(0, 8);
    return pool.filter((s) => tagSlug(s).includes(q) || s.toLowerCase().includes(draft.toLowerCase())).slice(0, 6);
  }, [draft, tags, suggestions]);

  function add(raw: string) {
    const next = normalizeTagNames([...tags, ...raw.split(",")]).map((t) => t.name).slice(0, MAX_TAGS_PER_PROJECT);
    setTags(next);
    setDraft("");
    setActive(0);
  }

  const open = focused && matches.length > 0 && tags.length < MAX_TAGS_PER_PROJECT;

  return (
    <div className="relative">
      <input type="hidden" name={name} value={tags.join(",")} />
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-12 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-line bg-ink-2/50 px-2 py-1.5 transition focus-within:border-ice/70 focus-within:ring-4 focus-within:ring-ice/10"
      >
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface py-1 pl-2.5 pr-1 font-mono text-xs">
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTags(tags.filter((x) => x !== t));
              }}
              aria-label={`Fjern ${t}`}
              className="rounded-md p-0.5 text-mist hover:text-danger"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 120);
            if (draft.trim()) add(draft);
          }}
          onKeyDown={(e) => {
            if (open && e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % matches.length);
            } else if (open && e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
              if (draft.trim()) {
                e.preventDefault();
                add(open && e.key !== "," ? matches[active] ?? draft : draft);
              } else if (e.key === "Enter" && open) {
                e.preventDefault();
                add(matches[active]);
              }
            } else if (e.key === "Backspace" && !draft && tags.length) {
              setTags(tags.slice(0, -1));
            }
          }}
          placeholder={tags.length ? "" : "Figma, React, Blender …"}
          aria-label="Legg til teknologi"
          aria-autocomplete="list"
          className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-[15px] text-fg outline-none placeholder:text-mist/45"
        />
      </div>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-surface p-2.5 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)]">
          {matches.map((m, i) => (
            <li key={m}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(m);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-xs transition ${
                  i === active ? "border-ice/60 bg-ice/10 text-fg" : "border-line text-mist hover:text-fg"
                }`}
              >
                <Plus className="size-3" /> {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
