"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { deleteChallengeAction, setChallengeStatusAction, setEntryHighlightedAction, submitEntryAction, withdrawEntryAction } from "@/app/actions/challenges";
import { useT } from "@/components/LocaleProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

type Result = { ok: boolean; error?: string };

function useRun() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, success?: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? t("Noe gikk galt."));
      if (success) toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

// Publiser, lukk og slett (administrasjonen).
export function ChallengeActions({ id, status }: { id: string; status: "draft" | "published" | "closed" }) {
  const t = useT();
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && (
        <Button size="xs" onClick={() => run(() => setChallengeStatusAction(id, "published"), t("Utfordringen er publisert"))} loading={pending}>
          {t("Publiser")}
        </Button>
      )}
      {status === "published" && (
        <Button size="xs" variant="secondary" onClick={() => run(() => setChallengeStatusAction(id, "closed"), t("Utfordringen er lukket"))} loading={pending}>
          {t("Lukk")}
        </Button>
      )}
      <Button size="xs" variant="ghost" className="hover:text-danger" aria-label={t("Slett utfordringen")} onClick={() => window.confirm(t("Slette utfordringen og alle svarene?")) && run(() => deleteChallengeAction(id), t("Slettet"))}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

// Bedriften fremhever et svar (stjerne).
export function HighlightEntry({ id, highlighted }: { id: string; highlighted: boolean }) {
  const t = useT();
  const { pending, run } = useRun();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => setEntryHighlightedAction(id, !highlighted), highlighted ? undefined : t("Svaret er fremhevet"))}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${highlighted ? "bg-warn/20 text-warn" : "glass-chip text-mist hover:text-fg"}`}
    >
      <Star className={`size-3.5 ${highlighted ? "fill-current" : ""}`} /> {highlighted ? t("Fremhevet") : t("Fremhev")}
    </button>
  );
}

type Own = { id: string; title: string; cover: string | null };

// «Svar med et prosjekt»: velg et av dine publiserte prosjekter, eller lag et nytt.
export function EntryForm({ challengeId, projects, existing, loggedIn }: { challengeId: string; projects: Own[]; existing: { projectId: string; note: string | null } | null; loggedIn: boolean }) {
  const t = useT();
  const { pending, run } = useRun();
  const [projectId, setProjectId] = useState(existing?.projectId ?? projects[0]?.id ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  if (!loggedIn) {
    return (
      <ButtonLink href={`/logg-inn?neste=${encodeURIComponent(`/utfordringer/${challengeId}`)}`} className="w-full">
        {t("Logg inn for å svare")}
      </ButtonLink>
    );
  }
  if (projects.length === 0) {
    return (
      <div className="space-y-3 text-sm text-mist">
        <p>{t("Lag prosjektet ditt på Vis først, så kan du svare med det her.")}</p>
        <ButtonLink href="/ny" className="w-full">
          {t("Del et prosjekt")}
        </ButtonLink>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => submitEntryAction(challengeId, projectId, note), existing ? t("Svaret er oppdatert") : t("Svaret er sendt"));
      }}
      className="space-y-3"
    >
      <label className="block text-sm font-medium text-fg">
        {t("Prosjektet ditt")}
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-2 h-11 w-full rounded-2xl bg-fill px-3 text-fg outline-none inset-ring inset-ring-line">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <textarea className={`${textareaClass} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={t("Kort om valgene du tok (valgfritt)")} aria-label={t("Kommentar")} />
      <Button type="submit" loading={pending} className="w-full">
        {existing ? t("Oppdater svaret") : t("Send svaret")}
      </Button>
      {existing && (
        <button type="button" disabled={pending} onClick={() => window.confirm(t("Trekke svaret?")) && run(() => withdrawEntryAction(challengeId), t("Svaret er trukket"))} className="w-full text-center text-sm text-mist hover:text-danger">
          {t("Trekk svaret")}
        </button>
      )}
      <p className="text-xs text-mist">
        {t("Mangler prosjektet?")}{" "}
        <Link href="/ny" className="text-ice hover:underline">
          {t("Del et nytt prosjekt")}
        </Link>
      </p>
    </form>
  );
}
