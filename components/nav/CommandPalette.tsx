"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, Compass, FileText, Flame, Hash, Plus, Search, UserPen, Users } from "lucide-react";
import { quickSearchAction, type QuickResult } from "@/app/actions/search";
import Avatar from "@/components/Avatar";
import { OPEN_SEARCH_EVENT } from "@/components/nav/search-events";
import { Kbd } from "@/components/ui/misc";

type Item = { key: string; href: string; label: string; hint?: string; icon: React.ReactNode; group: string };

const EMPTY: QuickResult = { people: [], projects: [], tags: [] };

// Søkepaletten (⌘K): hopp rett til en person, et prosjekt eller en teknologi.
export default function CommandPalette({ loggedIn, username }: { loggedIn: boolean; username?: string | null }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickResult>(EMPTY);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();

  const show = useCallback((initial = "") => {
    setQuery(initial);
    setResults(EMPTY);
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        show();
      }
    };
    const onOpen = (e: Event) => show((e as CustomEvent<{ query?: string }>).detail?.query ?? "");
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, [open, show]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Søk mens man skriver, litt forsinket.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    // Uten søkeord vises snarveiene, så de gamle treffene trenger ikke tømmes her.
    if (!q) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = await quickSearchAction(q);
        setResults(r);
        setActive(0);
      });
    }, 140);
    return () => clearTimeout(timer);
  }, [query, open]);

  const items: Item[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const base: Item[] = [
        { key: "utforsk", href: "/sok", label: "Utforsk prosjekter", icon: <Compass className="size-4" />, group: "Snarveier" },
        { key: "trender", href: "/sok?sort=trending", label: "Trender nå", icon: <Flame className="size-4" />, group: "Snarveier" },
        { key: "folk", href: "/sok?type=personer", label: "Finn folk", icon: <Users className="size-4" />, group: "Snarveier" },
      ];
      if (loggedIn) {
        base.push(
          { key: "ny", href: "/ny", label: "Del et prosjekt", icon: <Plus className="size-4" />, group: "Handlinger" },
          { key: "rediger", href: "/profil/rediger", label: "Rediger profilen", icon: <UserPen className="size-4" />, group: "Handlinger" },
          { key: "cv", href: username ? `/@${username}/cv` : "/profil/rediger/cv", label: "Se CV-en din", icon: <FileText className="size-4" />, group: "Handlinger" },
        );
      } else {
        base.push({ key: "register", href: "/register", label: "Lag en profil", icon: <Plus className="size-4" />, group: "Handlinger" });
      }
      return base;
    }
    return [
      ...results.people.map((p) => ({
        key: `p-${p.username}`,
        href: `/@${p.username}`,
        label: p.name,
        hint: p.headline ?? `@${p.username}`,
        icon: <Avatar name={p.name} image={p.image} size={22} />,
        group: "Personer",
      })),
      ...results.projects.map((p) => ({
        key: `pr-${p.id}`,
        href: `/prosjekt/${p.id}`,
        label: p.title,
        hint: p.owner,
        icon: p.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover} alt="" className="size-[22px] rounded-md object-cover" />
        ) : (
          <span className="flex size-[22px] items-center justify-center rounded-md bg-surface-2 text-[10px] font-bold text-ice">{p.title[0]}</span>
        ),
        group: "Prosjekter",
      })),
      ...results.tags.map((t) => ({
        key: `t-${t.slug}`,
        href: `/tag/${t.slug}`,
        label: t.name,
        icon: <Hash className="size-4" />,
        group: "Teknologier",
      })),
      {
        key: "alle",
        href: `/sok?q=${encodeURIComponent(q)}`,
        label: `Søk etter «${q}» i alt`,
        icon: <Search className="size-4" />,
        group: "Mer",
      },
    ];
  }, [query, results, loggedIn, username]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label="Søk"
      onClose={() => setOpen(false)}
      onCancel={(e) => {
        e.preventDefault();
        setOpen(false);
      }}
    >
      <div className="fixed inset-0 flex items-start justify-center px-3 pt-[12vh]" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_50px_100px_-40px_rgb(0_0_0/0.8)]">
          <div className="flex items-center gap-3 border-b border-line px-5">
            <Search className={`size-5 shrink-0 ${pending ? "animate-pulse text-ice" : "text-mist"}`} aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(items[active]);
                }
              }}
              placeholder="Søk etter folk, prosjekter eller teknologi…"
              aria-label="Søk"
              aria-activedescendant={items[active] ? `cmd-${items[active].key}` : undefined}
              aria-controls="cmd-list"
              role="combobox"
              aria-expanded="true"
              className="h-14 w-full bg-transparent text-[16px] text-fg outline-none placeholder:text-mist/55"
            />
            <Kbd>esc</Kbd>
          </div>

          <div ref={listRef} id="cmd-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
            {items.length === 1 && query.trim() && !pending && (
              <p className="px-3 pb-1 pt-3 text-sm text-mist">Ingen raske treff.</p>
            )}
            {items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const on = i === active;
              return (
                <div key={item.key}>
                  {header && <p className="px-3 pb-1.5 pt-3 label-mono">{header}</p>}
                  <button
                    type="button"
                    id={`cmd-${item.key}`}
                    role="option"
                    aria-selected={on}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition ${
                      on ? "bg-surface-2 text-fg" : "text-fg/90"
                    }`}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center text-mist">{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="hidden max-w-[45%] truncate text-sm text-mist sm:block">{item.hint}</span>}
                    {on && <ArrowRight className="size-4 shrink-0 text-ice" aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 border-t border-line px-5 py-2.5 text-xs text-mist">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> naviger
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> åpne
            </span>
            <span className="ml-auto hidden sm:block">
              Tips: trykk <Kbd>/</Kbd> hvor som helst
            </span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
