"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "@/components/LocaleProvider";
import { MAX_TAGS_PER_PROJECT, normalizeTagNames, tagSlug } from "@/lib/tag-names";

// Teknologier som merker. Enter eller komma legger til, og populære teknologier foreslås
// mens man skriver. Verdien sendes som kommaseparert tekst i et skjult felt. Brukes også
// til andre lister med merker (f.eks. «Hva trenger du hjelp med?» under Samarbeid).
export default function TagInput({
  name,
  defaultValue = [],
  suggestions = [],
  id,
  max = MAX_TAGS_PER_PROJECT,
  placeholder = "Figma, React, Blender …",
  label,
}: {
  name: string;
  defaultValue?: string[];
  suggestions?: string[];
  id?: string;
  max?: number;
  placeholder?: string;
  // Skjermleserteksten for feltet. Standard er «Legg til teknologi».
  label?: string;
}) {
  const t = useT();
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
    const next = normalizeTagNames([...tags, ...raw.split(",")]).map((tag) => tag.name).slice(0, max);
    setTags(next);
    setDraft("");
    setActive(0);
  }

  const open = focused && matches.length > 0 && tags.length < max;

  return (
    <div className="relative">
      <input type="hidden" name={name} value={tags.join(",")} />
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-12 cursor-text flex-wrap items-center gap-1.5 rounded-xl bg-fill px-2 py-1.5 inset-ring inset-ring-line inset-shadow-[0_1px_2px_rgb(0_0_0/0.1)] transition focus-within:bg-fill-2 focus-within:ring-2 focus-within:ring-sea/50"
      >
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface py-1 pl-3 pr-1 text-[13px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]">
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTags(tags.filter((x) => x !== tag));
              }}
              aria-label={t("Fjern {name}", { name: tag })}
              className="rounded-full p-0.5 text-mist hover:text-danger"
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
          placeholder={tags.length ? "" : placeholder}
          aria-label={label ?? t("Legg til teknologi")}
          aria-autocomplete="list"
          className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-[15px] text-fg outline-none placeholder:text-mist/60"
        />
      </div>
      {open && (
        <ul role="listbox" className="glass-strong absolute left-0 right-0 top-full z-30 mt-2 flex flex-wrap gap-1.5 rounded-[20px] p-2.5">
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
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium transition ${
                  i === active ? "bg-fill-2 text-fg" : "bg-fill text-mist hover:text-fg"
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
