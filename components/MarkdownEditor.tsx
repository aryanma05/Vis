"use client";

import { useMemo, useRef, useState } from "react";
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Quote, Wand2 } from "lucide-react";
import { useLocale, useT } from "@/components/LocaleProvider";
import Markdown from "@/components/Markdown";
import { dateLocale, type T } from "@/lib/i18n";

type Action = { label: string; Icon: typeof Bold; apply: (selected: string) => { text: string; select?: [number, number] } };

// Knappene i verktøylinjen. Uten markert tekst settes en plassholder inn på valgt språk.
function makeActions(t: T): Action[] {
  const bold = t("fet tekst");
  const italic = t("kursiv");
  const link = t("lenketekst");
  const item = t("Punkt");
  return [
    { label: t("Overskrift"), Icon: Heading2, apply: (s) => ({ text: `## ${s || t("Overskrift")}` }) },
    { label: t("Fet"), Icon: Bold, apply: (s) => ({ text: `**${s || bold}**`, select: [2, 2 + (s || bold).length] }) },
    { label: t("Kursiv"), Icon: Italic, apply: (s) => ({ text: `*${s || italic}*`, select: [1, 1 + (s || italic).length] }) },
    { label: t("Lenke"), Icon: Link2, apply: (s) => ({ text: `[${s || link}](https://)`, select: [(s || link).length + 3, (s || link).length + 11] }) },
    { label: t("Punktliste"), Icon: List, apply: (s) => ({ text: (s || item).split("\n").map((l) => `- ${l}`).join("\n") }) },
    { label: t("Nummerert liste"), Icon: ListOrdered, apply: (s) => ({ text: (s || item).split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n") }) },
    { label: t("Sitat"), Icon: Quote, apply: (s) => ({ text: (s || t("Sitat")).split("\n").map((l) => `> ${l}`).join("\n") }) },
    { label: t("Kode"), Icon: Code, apply: (s) => ({ text: s.includes("\n") ? `\`\`\`\n${s}\n\`\`\`` : `\`${s || t("kode")}\`` }) },
  ];
}

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
  templateLabel,
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
  const t = useT();
  const locale = useLocale();
  const actions = useMemo(() => makeActions(t), [t]);
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
    <div className={`overflow-hidden rounded-[18px] bg-fill inset-ring inset-shadow-[0_1px_2px_rgb(0_0_0/0.1)] transition focus-within:bg-fill-2 focus-within:ring-2 focus-within:ring-sea/50 ${invalid ? "inset-ring-danger/70" : "inset-ring-line"}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        <div role="tablist" className="mr-2 flex rounded-lg bg-ink/60 p-0.5">
          {(["write", "preview"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${tab === key ? "bg-surface-2 text-fg" : "text-mist hover:text-fg"}`}
            >
              {key === "write" ? t("Skriv") : t("Forhåndsvis")}
            </button>
          ))}
        </div>
        {tab === "write" &&
          actions.map((a) => (
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
              if (value.trim() && !confirm(t("Erstatte teksten med malen?"))) return;
              set(template);
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ice transition hover:bg-surface-2"
          >
            <Wand2 className="size-3.5" /> {templateLabel ?? t("Bruk mal")}
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
        <div className="min-h-40 px-5 py-4">{value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-mist">{t("Ingenting å forhåndsvise ennå.")}</p>}</div>
      )}
      <div className="flex justify-between border-t border-line/60 px-4 py-1.5 text-[11px] text-mist/70">
        <span>{t("Markdown støttes: **fet**, *kursiv*, lister, lenker og kode.")}</span>
        {maxLength && (
          <span>
            {value.length.toLocaleString(dateLocale(locale))} / {maxLength.toLocaleString(dateLocale(locale))}
          </span>
        )}
      </div>
    </div>
  );
}
