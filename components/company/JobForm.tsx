"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createJobAction, updateJobAction } from "@/app/actions/companies";
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

const TEMPLATE = `## Om rollen

Hva skal personen jobbe med, og hvem blir kollegaene?

## Vi ser etter deg som

-
-

## Vi tilbyr

-
`;

export default function JobForm({ companyId, jobId, initial, adminPath }: { companyId: string; jobId?: string; initial: JobValues; adminPath: string }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof JobValues>(key: K, value: JobValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const save = (publish: boolean) =>
    start(async () => {
      const tags = String(new FormData(formRef.current ?? undefined).get("tags") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = { ...values, tags };
      const result = jobId ? await updateJobAction(jobId, payload) : await createJobAction(companyId, payload, publish);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(jobId ? "Lagret" : publish ? "Stillingen er publisert" : "Lagret som utkast");
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
      <Field label="Tittel">
        <input className={inputClass} value={values.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required placeholder="F.eks. Frontend-utvikler" />
      </Field>
      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="Type">
          <select className={inputClass} value={values.type} onChange={(e) => set("type", e.target.value)}>
            {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Arbeidssted" optional>
          <input className={inputClass} value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="Oslo" maxLength={100} />
        </Field>
        <Field label="Hjemmekontor">
          <select className={inputClass} value={values.remote} onChange={(e) => set("remote", e.target.value)}>
            {Object.entries(REMOTE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Beskrivelse" htmlFor="stilling-beskrivelse">
        <MarkdownEditor id="stilling-beskrivelse" value={values.description} onChange={(v) => set("description", v)} maxLength={20_000} template={TEMPLATE} templateLabel="Start med en mal" placeholder="Hva skal personen gjøre? …" />
      </Field>
      <Field label="Teknologier og ferdigheter" optional hint="Gjør stillingen lettere å finne." htmlFor="stilling-tagger">
        <TagInput id="stilling-tagger" name="tags" defaultValue={values.tags} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Søknadslenke" optional hint="Eller e-post under.">
          <input className={inputClass} value={values.applyUrl} onChange={(e) => set("applyUrl", e.target.value)} placeholder="https://jobs.bedrift.no/123" />
        </Field>
        <Field label="Søknad på e-post" optional>
          <input className={inputClass} type="email" value={values.applyEmail} onChange={(e) => set("applyEmail", e.target.value)} placeholder="jobb@bedrift.no" />
        </Field>
      </div>
      <Field label="Søknadsfrist" optional hint="Tom = løpende.">
        <input className={`${inputClass} w-auto`} type="date" value={values.deadline} onChange={(e) => set("deadline", e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {jobId ? (
          <Button type="submit" loading={pending}>
            Lagre
          </Button>
        ) : (
          <>
            <Button type="submit" loading={pending}>
              Publiser
            </Button>
            <Button type="button" variant="secondary" loading={pending} onClick={() => save(false)}>
              Lagre som utkast
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
