"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, UserX, X } from "lucide-react";
import { quickSearchAction } from "@/app/actions/search";
import Avatar from "@/components/Avatar";
import { useT } from "@/components/LocaleProvider";
import { inputClass } from "@/components/ui/field";

export type MemberOption = { username: string; name: string; image: string | null };

// Velg andre som har vært med på prosjektet: søk etter navn eller brukernavn og trykk
// for å legge til. Skjemaet får brukernavnene som en kommaseparert liste i `name`.
export default function MemberPicker({
  name,
  value,
  onChange,
  exclude,
  max,
}: {
  name: string;
  value: MemberOption[];
  onChange: (members: MemberOption[]) => void;
  // Brukernavn som ikke skal foreslås (deg selv).
  exclude?: string;
  max: number;
}) {
  const t = useT();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberOption[]>([]);
  // Søket resultatene hører til, så «ingen treff» bare vises når søket faktisk er ferdig.
  const [searched, setSearched] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const q = query.trim().replace(/^@/, "");
  const taken = new Set([...value.map((m) => m.username), ...(exclude ? [exclude.toLowerCase()] : [])]);
  const suggestions = q ? results.filter((p) => !taken.has(p.username)) : [];
  const full = value.length >= max;
  const noMatch = Boolean(q) && searched === q && suggestions.length === 0;

  useEffect(() => {
    if (!q) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await quickSearchAction(q).catch(() => null);
      if (stale || !result) return;
      setResults(result.people.map(({ username, name, image }) => ({ username, name, image })));
      setSearched(q);
      setActive(0);
    }, 150);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q]);

  function add(person: MemberOption) {
    if (full || taken.has(person.username)) return;
    onChange([...value, person]);
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  const remove = (username: string) => onChange(value.filter((m) => m.username !== username));
  const showList = open && suggestions.length > 0;
  // Teksten står igjen i feltet uten at noen er lagt til: si fra, ellers forsvinner den ved lagring.
  const leftover = !open && Boolean(q) && !full;

  return (
    <div>
      <input type="hidden" name={name} value={value.map((m) => m.username).join(",")} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("Søk etter medlemmer")}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={full}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !query && value.length > 0) {
              remove(value[value.length - 1].username);
              return;
            }
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              add(suggestions[Math.min(active, suggestions.length - 1)]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={full ? t("Maks {n} medlemmer.", { n: max }) : t("Søk etter navn eller @brukernavn")}
          className={`${inputClass} pl-10`}
        />

        <AnimatePresence>
          {showList && (
            <motion.ul
              id={listId}
              role="listbox"
              aria-label={t("Forslag")}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="glass-strong absolute left-0 right-0 top-full z-30 mt-2 origin-top overflow-hidden rounded-[20px] p-1.5 sm:right-auto sm:w-80"
            >
              {suggestions.map((p, i) => (
                <li key={p.username}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(p);
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
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {open && noMatch && (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mist" role="status">
          <UserX className="size-4 shrink-0" aria-hidden="true" />
          {t("Fant ingen som heter «{q}». Personen må ha en profil på Vis.", { q })}
        </p>
      )}
      {leftover && (
        <p className="mt-2 text-[13px] text-warn" role="status">
          {t("Trykk på personen i listen for å legge dem til.")}
        </p>
      )}

      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("Medlemmer")}>
          <AnimatePresence initial={false}>
            {value.map((m) => (
              <motion.li
                key={m.username}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className="glass-chip flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5"
              >
                <Avatar name={m.name} image={m.image} size={26} />
                <span className="max-w-40 truncate text-sm font-medium text-fg">{m.name}</span>
                <button
                  type="button"
                  onClick={() => remove(m.username)}
                  aria-label={t("Fjern {name}", { name: m.name })}
                  title={t("Fjern {name}", { name: m.name })}
                  className="flex size-6 items-center justify-center rounded-full text-mist transition hover:bg-fill-2 hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
