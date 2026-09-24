"use client";

import { useEffect } from "react";
import { recordViewAction } from "@/app/actions/social";

// Teller én visning per økt for et prosjekt eller en profil (lagres uten å vite hvem).
export default function ViewTracker({ kind, id }: { kind: "project" | "profile"; id: string }) {
  useEffect(() => {
    const key = `vis-view:${kind}:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Privat vindu uten lagring: tell likevel.
    }
    const timer = setTimeout(() => void recordViewAction(kind, id), 1200);
    return () => clearTimeout(timer);
  }, [kind, id]);
  return null;
}
