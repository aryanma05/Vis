"use client";

import { useEffect } from "react";

// Teller én visning per stilling og økt.
export default function JobViewCounter({ id }: { id: string }) {
  useEffect(() => {
    const key = `vis-stilling-${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    void fetch(`/api/stillinger/${id}/visning`, { method: "POST", keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
