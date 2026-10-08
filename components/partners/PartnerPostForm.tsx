"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Hammer, Lightbulb } from "lucide-react";
import { savePartnerPostAction } from "@/app/actions/partners";
import { useT } from "@/components/LocaleProvider";
import TagInput from "@/components/TagInput";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, inputClass, selectClass, textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import {
  type Commitment,
  COMMITMENT_LABELS,
  COMMITMENTS,
  MAX_PARTNER_NEEDS,
  PARTNER_NEED_SUGGESTIONS,
  PARTNER_STAGE_LABELS,
  type PartnerStage,
} from "@/lib/constants";

export type PartnerPostValues = {
  title: string;
  description: string;
  stage: PartnerStage;
  projectId: string;
  needs: string[];
  commitments: Commitment[];
};

const STAGE_INFO: Record<PartnerStage, { Icon: typeof Lightbulb; hint: string }> = {
  ide: { Icon: Lightbulb, hint: "En tanke eller en skisse, ingenting er laget ennå." },
  pabegynt: { Icon: Hammer, hint: "Noe du allerede har startet på." },
};

const DESCRIPTION_MAX = 5000;

// Legg ut en idé eller et påbegynt prosjekt på /partnere, og si hva du trenger hjelp med.
export default function PartnerPostForm({
  postId,
  initial,
  projects,
}: {
  postId?: string;
  initial: PartnerPostValues;
  // Egne prosjekter på Vis, til «Påbegynt prosjekt».
  projects: { id: string; title: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  // Feilen for et felt forsvinner så snart det endres.
  const set = <K extends keyof PartnerPostValues>(key: K, value: PartnerPostValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const toggleCommitment = (c: Commitment) =>
    set("commitments", values.commitments.includes(c) ? values.commitments.filter((x) => x !== c) : [...values.commitments, c]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const needs = String(new FormData(event.currentTarget).get("needs") ?? "");
    start(async () => {
      setErrors({});
      const result = await savePartnerPostAction(postId ?? null, {
        ...values,
        projectId: values.stage === "pabegynt" ? values.projectId : null,
        needs,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(postId ? t("Lagret") : t("Prosjektet er lagt ut"), postId ? undefined : { description: t("Nå kan andre tilby seg å hjelpe.") });
      router.push(`/partnere/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-fg">{t("Hvor langt har du kommet?")}</legend>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(STAGE_INFO) as PartnerStage[]).map((stage) => {
            const { Icon, hint } = STAGE_INFO[stage];
            const active = values.stage === stage;
            return (
              <button
                key={stage}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("stage", stage)}
                className={`flex items-start gap-3 rounded-[18px] p-4 text-left transition ${active ? "bg-primary/10 ring-2 ring-primary/60" : "glass-chip hover:bg-fill-2"}`}
              >
                <Icon className={`mt-0.5 size-5 shrink-0 ${active ? "text-fg" : "text-mist"}`} aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-fg">{t(PARTNER_STAGE_LABELS[stage])}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-mist">{t(hint)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {values.stage === "pabegynt" && projects.length > 0 && (
        <Field label={t("Prosjektet på Vis")} optional hint={t("Vises sammen med utlysningen, så folk ser hva som er laget.")} error={errors.projectId?.[0]}>
          <select className={selectClass} value={values.projectId} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">{t("Ikke delt på Vis ennå")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label={t("Hva heter det?")} error={errors.title?.[0]}>
        <input
          className={inputClass}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={100}
          required
          aria-invalid={Boolean(errors.title) || undefined}
          placeholder={t("F.eks. En app for turlag")}
        />
      </Field>

      <Field label={t("Om prosjektet")} error={errors.description?.[0]} hint={t("Hva vil du lage, for hvem, og hvor langt har du kommet?")}>
        <textarea
          className={`${textareaClass} min-h-40`}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={DESCRIPTION_MAX}
          required
          aria-invalid={Boolean(errors.description) || undefined}
          placeholder={t("Fortell om ideen, hva som finnes allerede, og hvordan du ser for deg at dere jobber sammen.")}
        />
      </Field>

      <Field
        label={t("Hva trenger du hjelp med?")}
        htmlFor="partner-behov"
        error={errors.needs?.[0]}
        hint={t("Roller, ferdigheter eller oppgaver. Velg forslag eller skriv dine egne, maks {n}.", { n: MAX_PARTNER_NEEDS })}
      >
        <TagInput
          id="partner-behov"
          name="needs"
          defaultValue={initial.needs}
          suggestions={PARTNER_NEED_SUGGESTIONS.map((s) => t(s))}
          max={MAX_PARTNER_NEEDS}
          placeholder={t("Design, backend, markedsføring …")}
          label={t("Legg til noe du trenger hjelp med")}
        />
      </Field>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-fg">{t("Hva slags hjelp passer?")}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {COMMITMENTS.map((c) => {
            const active = values.commitments.includes(c);
            return (
              <button
                key={c}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleCommitment(c)}
                className={`relative rounded-[18px] p-4 pr-10 text-left transition ${active ? "bg-primary/10 ring-2 ring-primary/60" : "glass-chip hover:bg-fill-2"}`}
              >
                <span className="block font-semibold text-fg">{t(COMMITMENT_LABELS[c].label)}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-mist">{t(COMMITMENT_LABELS[c].description)}</span>
                <span
                  aria-hidden="true"
                  className={`absolute right-3 top-3 flex size-5 items-center justify-center rounded-full ${active ? "bg-primary text-on-primary" : "inset-ring inset-ring-line"}`}
                >
                  {active && <Check className="size-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
        {errors.commitments?.[0] ? (
          <p role="alert" className="mt-1.5 text-[13px] leading-5 text-danger">
            {errors.commitments[0]}
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] leading-5 text-mist">{t("Den som vil hjelpe velger en av disse.")}</p>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-2 border-t border-line pt-6">
        <Button type="submit" loading={pending}>
          {postId ? t("Lagre") : t("Legg ut")}
        </Button>
        <Link href={postId ? `/partnere/${postId}` : "/partnere"} className={buttonClass({ variant: "ghost" })}>
          {t("Avbryt")}
        </Link>
      </div>
    </form>
  );
}
