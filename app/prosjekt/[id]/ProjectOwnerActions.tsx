"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProjectAction, setProjectStatusAction } from "@/app/actions/projects";
import { ui } from "@/components/ui";

export default function ProjectOwnerActions({ projectId, status }: { projectId: string; status: "draft" | "published" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const togglePublish = () =>
    startTransition(async () => {
      const result = await setProjectStatusAction(projectId, status === "draft" ? "published" : "draft");
      if (!result.ok) setError(result.error);
      router.refresh();
    });

  const remove = () => {
    if (!confirm("Slette prosjektet? Dette kan ikke angres.")) return;
    startTransition(async () => {
      const result = await deleteProjectAction(projectId);
      if (!result.ok) return setError(result.error);
      router.push("/");
      router.refresh();
    });
  };

  return (
    <div className="mt-6 rounded-2xl border border-[#174B76] bg-[#0A245E] p-4">
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" && <span className="rounded-full bg-amber-400/15 px-3 py-1 text-sm text-amber-200">Utkast – bare du ser dette</span>}
        <Link href={`/prosjekt/${projectId}/rediger`} className={`${ui.secondary} py-2 text-sm`}>
          Rediger
        </Link>
        <button type="button" onClick={togglePublish} disabled={pending} className={`${ui.primary} py-2 text-sm`}>
          {status === "draft" ? "Publiser" : "Gjør til utkast"}
        </button>
        <button type="button" onClick={remove} disabled={pending} className={ui.danger}>
          Slett
        </button>
      </div>
      {error && <p className={`${ui.error} mt-3`}>{error}</p>}
    </div>
  );
}
