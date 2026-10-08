"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createChallengeAction, updateChallengeAction } from "@/app/actions/challenges";
import { useLocale, useT } from "@/components/LocaleProvider";
import MarkdownEditor from "@/components/MarkdownEditor";
import TagInput from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

export type ChallengeValues = { title: string; description: string; reward: string; deadline: string; tags: string[] };

const TEMPLATE = {
  nb: `## Oppgaven

Hva skal lages? Hold den liten nok til en helg, f.eks. «en landingsside for en sykkelbutikk».

## Dette ser vi etter

-
-

## Slik svarer du

Del prosjektet på Vis (gjerne med lenke til koden og en kort tekst om valgene du tok), og svar med det her.
`,
  en: `## The task

What should be built? Keep it small enough for a weekend, e.g. “a landing page for a bike shop”.

## What we're looking for

-
-

## How to answer

Share the project on Vis (ideally with a link to the code and a short note on the choices you made), and answer with it here.
`,
};

export default function ChallengeForm({ companyId, challengeId, initial, adminPath }: { companyId: string; challengeId?: string; initial: ChallengeValues; adminPath: string }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [values, setValues] = useState(initial);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof ChallengeValues>(key: K, value: ChallengeValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const save = (publish: boolean) =>
    start(async () => {
      const tags = String(new FormData(formRef.current ?? undefined).get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const payload = { ...values, tags };
      const result = challengeId ? await updateChallengeAction(challengeId, payload) : await createChallengeAction(companyId, payload, publish);
      if (!result.ok) return void toast.error(result.error);
      toast.success(challengeId ? t("Lagret") : publish ? t("Utfordringen er publisert") : t("Lagret som utkast"));
      router.push(`${adminPath}?fane=utfordringer`);
      router.refresh();
    });

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
      className="max-w-3xl space-y-6"
    >
      <Field label={t("Tittel")}>
        <input className={inputClass} value={values.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required placeholder={t("F.eks. Lag en landingsside for en sykkelbutikk")} />
      </Field>
      <Field label={t("Beskrivelse")} htmlFor="utfordring-beskrivelse">
        <MarkdownEditor id="utfordring-beskrivelse" value={values.description} onChange={(v) => set("description", v)} maxLength={20_000} template={TEMPLATE[locale]} templateLabel={t("Start med en mal")} placeholder={t("Hva skal lages? …")} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Field label={t("Hva får man?")} optional hint={t("F.eks. «Intervju med teamet og gavekort på 2 000 kr».")}>
          <input className={inputClass} value={values.reward} onChange={(e) => set("reward", e.target.value)} maxLength={200} />
        </Field>
        <Field label={t("Frist")} optional hint={t("Tom = løpende.")}>
          <input className={inputClass} type="date" value={values.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </Field>
      </div>
      <Field label={t("Teknologier")} optional hint={t("Gjør utfordringen lettere å finne.")} htmlFor="utfordring-tagger">
        <TagInput id="utfordring-tagger" name="tags" defaultValue={values.tags} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {challengeId ? (
          <Button type="submit" loading={pending}>
            {t("Lagre")}
          </Button>
        ) : (
          <>
            <Button type="submit" loading={pending}>
              {t("Publiser")}
            </Button>
            <Button type="button" variant="secondary" loading={pending} onClick={() => save(false)}>
              {t("Lagre som utkast")}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
