"use client";

import { useRef, useState } from "react";
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Quote, Wand2 } from "lucide-react";
import Markdown from "@/components/Markdown";

type Action = { label: string; Icon: typeof Bold; apply: (selected: string) => { text: string; select?: [number, number] } };

const ACTIONS: Action[] = [
  { label: "Overskrift", Icon: Heading2, apply: (s) => ({ text: `## ${s || "Overskrift"}` }) },
  { label: "Fet", Icon: Bold, apply: (s) => ({ text: `**${s || "fet tekst"}**`, select: [2, 2 + (s || "fet tekst").length] }) },
  { label: "Kursiv", Icon: Italic, apply: (s) => ({ text: `*${s || "kursiv"}*`, select: [1, 1 + (s || "kursiv").length] }) },
  { label: "Lenke", Icon: Link2, apply: (s) => ({ text: `[${s || "lenketekst"}](https://)`, select: [(s || "lenketekst").length + 3, (s || "lenketekst").length + 11] }) },
  { label: "Punktliste", Icon: List, apply: (s) => ({ text: (s || "Punkt").split("\n").map((l) => `- ${l}`).join("\n") }) },
  { label: "Nummerert liste", Icon: ListOrdered, apply: (s) => ({ text: (s || "Punkt").split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n") }) },
  { label: "Sitat", Icon: Quote, apply: (s) => ({ text: (s || "Sitat").split("\n").map((l) => `> ${l}`).join("\n") }) },
  { label: "Kode", Icon: Code, apply: (s) => ({ text: s.includes("\n") ? `\`\`\`\n${s}\n\`\`\`` : `\`${s || "kode"}\`` }) },
];

// Tekstfelt for markdown med verktøylinje og forhåndsvisning. Kan brukes både
// kontrollert (value/onChange) og som vanlig skjemafelt (name/defaultValue).
export default function MarkdownEditor({
  id,
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  placeholder,
  rows = 10,
  maxLength,
  template,
  templateLabel = "Bruk mal",
  invalid,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  template?: string;
  templateLabel?: string;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const value = controlled ?? internal;

  const set = (next: string) => {
    if (controlled === undefined) setInternal(next);
    onChange?.(next);
  };

  function run(action: Action) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const { text, select } = action.apply(selected);
    // Blokkelementer (liste, overskrift, sitat) skal starte på egen linje.
    const needsNewline = /^(#|-|\d+\.|>|```)/.test(text) && start > 0 && value[start - 1] !== "\n";
    const insert = `${needsNewline ? "\n" : ""}${text}`;
    const next = value.slice(0, start) + insert + value.slice(end);
    set(next);
    requestAnimationFrame(() => {
      el.focus();
      const offset = start + (needsNewline ? 1 : 0);
      if (select) el.setSelectionRange(offset + select[0], offset + select[1]);
      else el.setSelectionRange(offset + text.length, offset + text.length);
    });
  }

  return (
    <div className={`overflow-hidden rounded-2xl border bg-ink-2/50 transition focus-within:border-ice/60 focus-within:ring-4 focus-within:ring-ice/10 ${invalid ? "border-danger/70" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        <div role="tablist" className="mr-2 flex rounded-lg bg-ink/60 p-0.5">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${tab === t ? "bg-surface-2 text-fg" : "text-mist hover:text-fg"}`}
            >
              {t === "write" ? "Skriv" : "Forhåndsvis"}
            </button>
          ))}
        </div>
        {tab === "write" &&
          ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => run(a)}
              aria-label={a.label}
              title={a.label}
              className="rounded-md p-1.5 text-mist transition hover:bg-surface-2 hover:text-fg"
            >
              <a.Icon className="size-4" />
            </button>
          ))}
        {template && tab === "write" && (
          <button
            type="button"
            onClick={() => {
              if (value.trim() && !confirm("Erstatte teksten med malen?")) return;
              set(template);
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ice transition hover:bg-surface-2"
          >
            <Wand2 className="size-3.5" /> {templateLabel}
          </button>
        )}
      </div>
      {name && <input type="hidden" name={name} value={value} />}
      {tab === "write" ? (
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          className="block min-h-40 w-full resize-y bg-transparent px-4 py-3 font-mono text-[13.5px] leading-6 text-fg outline-none placeholder:font-sans placeholder:text-mist/45"
        />
      ) : (
        <div className="min-h-40 px-5 py-4">{value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-mist">Ingenting å forhåndsvise ennå.</p>}</div>
      )}
      <div className="flex justify-between border-t border-line/60 px-4 py-1.5 text-[11px] text-mist/70">
        <span>Markdown støttes: **fet**, *kursiv*, lister, lenker og kode.</span>
        {maxLength && (
          <span>
            {value.length.toLocaleString("nb-NO")} / {maxLength.toLocaleString("nb-NO")}
          </span>
        )}
      </div>
    </div>
  );
}
