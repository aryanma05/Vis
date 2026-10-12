"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";

type Item = { key: string; label: string; href: string; count?: number };

// Fanene på profilen. Innholdet i alle fanene kommer med siden, så byttet skjer i nettleseren
// med en gang. Adressen (?fane=) oppdateres med pushState, så delte lenker og tilbake-knappen virker.
export default function ProfileTabs({ label, items, panels }: { label: string; items: Item[]; panels: Record<string, ReactNode> }) {
  const fane = useSearchParams().get("fane");
  const active = items.find((i) => i.key === fane)?.key ?? items[0].key;

  return (
    <>
      <Tabs
        label={label}
        active={active}
        items={items}
        onSelect={(key) => window.history.pushState(null, "", items.find((i) => i.key === key)?.href)}
      />
      <div className="pt-8">
        {items.map((i) => (
          <div key={i.key} hidden={i.key !== active}>
            {panels[i.key]}
          </div>
        ))}
      </div>
    </>
  );
}
