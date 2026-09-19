"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markNotificationsReadAction } from "@/app/actions/notifications";

// Markerer varslene som lest når siden faktisk er åpnet (ikke ved forhåndslasting).
export default function MarkRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!hasUnread) return;
    markNotificationsReadAction().then(() => router.refresh());
  }, [hasUnread, router]);
  return null;
}
