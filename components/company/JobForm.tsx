"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createJobAction, updateJobAction } from "@/app/actions/companies";
import { useLocale, useT } from "@/components/LocaleProvider";
import MarkdownEditor from "@/components/MarkdownEditor";
import TagInput from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { JOB_TYPE_LABELS, REMOTE_LABELS } from "@/lib/constants";

export type JobValues = {
  title: string;
  description: string;
  location: string;
  remote: string;
  type: string;
  applyUrl: string;
  applyEmail: string;
  deadline: string;
  tags: string[];
};

const TEMPLATE = {
  nb: `## Om rollen

Hva skal personen jobbe med, og hvem blir kollegaene?

## Vi ser etter deg som

-
-

## Vi tilbyr

-
`,
  en: `## About the role

What will the person work on, and who will their colleagues be?

## We're looking for someone who

-
-

## We offer

-
`,
};

export default function JobForm({ companyId, jobId, initial, adminPath }: { companyId: string; jobId?: string; initial: JobValues; adminPath: string }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [values, setValues] = useState(initial);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof JobValues>(key: K, value: JobValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const save = (publish: boolean) =>
    start(async () => {
      const tags = String(new FormData(formRef.current ?? undefined).get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const payload = { ...values, tags };
      const result = jobId ? await updateJobAction(jobId, payload) : await createJobAction(companyId, payload, publish);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(jobId ? t("Lagret") : publish ? t("Stillingen er publisert") : t("Lagret som utkast"));
      router.push(adminPath);
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
        <input
          className={inputClass}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={120}
          required
          placeholder={t("F.eks. Frontend-utvikler")}
        />
      </Field>
      <div className="grid gap-6 sm:grid-cols-3">
        <Field label={t("Type")}>
          <select className={inputClass} value={values.type} onChange={(e) => set("type", e.target.value)}>
            {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Arbeidssted")} optional>
          <input className={inputClass} value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="Oslo" maxLength={100} />
        </Field>
        <Field label={t("Hjemmekontor")}>
          <select className={inputClass} value={values.remote} onChange={(e) => set("remote", e.target.value)}>
            {Object.entries(REMOTE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("Beskrivelse")} htmlFor="stilling-beskrivelse">
        <MarkdownEditor
          id="stilling-beskrivelse"
          value={values.description}
          onChange={(v) => set("description", v)}
          maxLength={20_000}
          template={TEMPLATE[locale]}
          templateLabel={t("Start med en mal")}
          placeholder={t("Hva skal personen gjøre? …")}
        />
      </Field>
      <Field label={t("Teknologier og ferdigheter")} optional hint={t("Gjør stillingen lettere å finne.")} htmlFor="stilling-tagger">
        <TagInput id="stilling-tagger" name="tags" defaultValue={values.tags} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("Søknadslenke")} optional hint={t("Eller e-post under.")}>
          <input className={inputClass} value={values.applyUrl} onChange={(e) => set("applyUrl", e.target.value)} placeholder="https://jobs.bedrift.no/123" />
        </Field>
        <Field label={t("Søknad på e-post")} optional>
          <input className={inputClass} type="email" value={values.applyEmail} onChange={(e) => set("applyEmail", e.target.value)} placeholder={t("jobb@bedrift.no")} />
        </Field>
      </div>
      <Field label={t("Søknadsfrist")} optional hint={t("Tom = løpende.")}>
        <input className={`${inputClass} w-auto`} type="date" value={values.deadline} onChange={(e) => set("deadline", e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {jobId ? (
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
