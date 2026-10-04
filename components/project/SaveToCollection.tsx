"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Check, Globe2, Lock, Plus } from "lucide-react";
import { createCollectionAction, listMyCollectionsAction, setCollectionItemAction } from "@/app/actions/collections";
import { Button, ButtonLink, buttonClass, Spinner } from "@/components/ui/button";
import { useT } from "@/components/LocaleProvider";
import Dialog from "@/components/ui/dialog";
import { inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

type Item = { id: string; title: string; isPublic: boolean; items: number; hasProject: boolean };

// «Lagre» på et prosjekt: legg det i en eller flere samlinger, eller lag en ny.
export default function SaveToCollection({ projectId, loggedIn }: { projectId: string; loggedIn: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [pending, start] = useTransition();
  const saved = items?.some((i) => i.hasProject) ?? false;

  async function load() {
    setOpen(true);
    if (!loggedIn) return;
    const result = await listMyCollectionsAction(projectId);
    if (result.ok) setItems(result.data);
    else toast.error(result.error);
  }

  async function toggle(item: Item) {
    const on = !item.hasProject;
    setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, hasProject: on, items: i.items + (on ? 1 : -1) } : i)) ?? null);
    const result = await setCollectionItemAction(item.id, projectId, on);
    if (!result.ok) {
      toast.error(result.error);
      setItems((list) => list?.map((i) => (i.id === item.id ? item : i)) ?? null);
    }
  }

  const create = () =>
    start(async () => {
      const result = await createCollectionAction({ title, isPublic }, projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems((list) => [{ id: result.data.id, title: title.trim(), isPublic, items: 1, hasProject: true }, ...(list ?? [])]);
      setTitle("");
      toast.success(t("Lagret i den nye samlingen"));
    });

  return (
    <>
      <button
        type="button"
        onClick={load}
        aria-label={t(saved ? "Lagret i en samling" : "Lagre i en samling")}
        className={buttonClass({ variant: "secondary", size: "icon" })}
      >
        {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("Lagre i en samling")} description={t("Samle prosjekter du vil huske, eller lag offentlige lister andre kan se.")} size="sm">
        {!loggedIn ? (
          <div className="mt-5 flex gap-2">
            <ButtonLink href="/logg-inn" size="sm">
              {t("Logg inn")}
            </ButtonLink>
            <ButtonLink href="/register" size="sm" variant="secondary">
              {t("Lag profil")}
            </ButtonLink>
          </div>
        ) : items === null ? (
          <div className="mt-6 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="mt-5">
            {items.length > 0 && (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.hasProject}
                      onClick={() => toggle(item)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-fill"
                    >
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded-md ${item.hasProject ? "bg-sea text-white" : "ring-1 ring-inset ring-line"}`}>
                        {item.hasProject && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                      <span className="flex items-center gap-1 text-xs text-mist">
                        {item.isPublic ? <Globe2 className="size-3.5" aria-label={t("Offentlig")} /> : <Lock className="size-3.5" aria-label={t("Privat")} />}
                        {item.items}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className={items.length > 0 ? "mt-4 border-t border-line pt-4" : ""}
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) create();
              }}
            >
              <label htmlFor="ny-samling" className="text-sm font-medium">
                {t("Ny samling")}
              </label>
              <div className="mt-2 flex gap-2">
                <input id="ny-samling" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t("F.eks. «Inspirasjon»")} />
                <Button type="submit" size="sm" loading={pending} disabled={!title.trim()} aria-label={t("Lag samling")}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-mist">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="size-4 accent-[var(--sea)]" />
                {t("Vis samlingen på profilen min")}
              </label>
            </form>
          </div>
        )}
      </Dialog>
    </>
  );
}
