"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";

// «Filtrer»: alle filtrene på en side bak én knapp, i et ark over siden. Står knappen i et
// skjema, sender «Vis treff» skjemaet (feltene i arket hører til det).
export default function FilterButton({ active, children, submit = false }: { active: number; children: ReactNode; submit?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
          active > 0 ? "bg-primary text-on-primary" : "glass-chip text-fg hover:bg-fill-2"
        }`}
      >
        <SlidersHorizontal className="size-4" /> {t("Filtrer")}
        {active > 0 && <span className="rounded-full bg-on-primary/15 px-1.5 text-xs tabular-nums">{active}</span>}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("Filtrer")}>
        <div className="space-y-6">{children}</div>
        <Button type={submit ? "submit" : "button"} onClick={() => setOpen(false)} className="mt-8 w-full">
          {t("Vis treff")}
        </Button>
      </Dialog>
    </>
  );
}

export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="caption">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

// Et valg i arket: en lenke når filteret står i adressen, ellers en knapp.
export function FilterChip({ active, href, onClick, children }: { active: boolean; href?: string; onClick?: () => void; children: ReactNode }) {
  const cls = `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
    active ? "bg-primary text-on-primary" : "glass-chip text-fg hover:bg-fill-2"
  }`;
  return href ? (
    <Link href={href} replace scroll={false} aria-current={active ? "true" : undefined} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {children}
    </button>
  );
}
