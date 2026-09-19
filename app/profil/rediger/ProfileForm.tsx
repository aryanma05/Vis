"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { updateProfileAction, uploadAvatarAction } from "@/app/actions/profile";
import Avatar from "@/components/Avatar";
import { Field, inputClass, Section } from "@/components/form";

type Link = { label: string; url: string };
type Values = {
  name: string;
  headline: string;
  location: string;
  websiteUrl: string;
  bio: string;
  links: Link[];
};

export default function ProfileForm({ initial, image }: { initial: Values; image: string | null }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [avatar, setAvatar] = useState(image);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  async function uploadAvatar(file: File) {
    if (file.size > 4 * 1024 * 1024) return setMessage({ type: "error", text: "Bildet er større enn 4 MB." });
    setUploading(true);
    const fd = new FormData();
    fd.append("avatar", file);
    const result = await uploadAvatarAction(fd);
    setUploading(false);
    if (!result.ok) return setMessage({ type: "error", text: result.error });
    setAvatar(result.data.url);
    router.refresh();
  }

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const links = values.links.filter((l) => l.label.trim() || l.url.trim());
      const result = await updateProfileAction({ ...values, links });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        return setMessage({ type: "error", text: result.error });
      }
      setErrors({});
      setMessage({ type: "ok", text: "Profilen er lagret." });
      router.refresh();
    });

  const err = (key: string) => errors[key]?.[0];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Section title="Profilbilde" description="Et tydelig bilde av deg, eller en logo. Maks 4 MB.">
        <div className="flex items-center gap-6">
          <Avatar name={values.name || "?"} image={avatar} size={88} className="rounded-2xl" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-ice disabled:opacity-60"
            >
              {uploading ? "Laster opp…" : "Last opp nytt"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAvatar(file);
              e.target.value = "";
            }}
          />
        </div>
      </Section>

      <Section title="Om deg" description="Vises øverst på profilen din.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Navn" error={err("name")}>
            <input className={inputClass} value={values.name} onChange={(e) => set("name", e.target.value)} required maxLength={100} />
          </Field>
          <Field label="Bosted" error={err("location")}>
            <input
              className={inputClass}
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Oslo"
              maxLength={100}
            />
          </Field>
          <Field label="Tittel" hint="Én linje om hva du driver med." error={err("headline")} className="md:col-span-2">
            <input
              className={inputClass}
              value={values.headline}
              onChange={(e) => set("headline", e.target.value)}
              placeholder="Frontend-utvikler som liker små detaljer"
              maxLength={120}
            />
          </Field>
          <Field label="Bio" error={err("bio")} className="md:col-span-2">
            <textarea
              className={`${inputClass} min-h-32 resize-y leading-7`}
              value={values.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Hva jobber du med, hva er du nysgjerrig på, og hva ser du etter?"
              maxLength={2000}
            />
          </Field>
        </div>
      </Section>

      <Section title="Lenker" description="Nettside, LinkedIn, Dribbble eller noe annet folk bør se.">
        <div className="space-y-3">
          <Field label="Nettside" error={err("websiteUrl")}>
            <input
              className={inputClass}
              value={values.websiteUrl}
              onChange={(e) => set("websiteUrl", e.target.value)}
              placeholder="https://"
              type="url"
            />
          </Field>
          {values.links.map((link, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-36 shrink-0 sm:w-44">
                <input
                  className={inputClass}
                  value={link.label}
                  onChange={(e) => set("links", values.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
                  placeholder="LinkedIn"
                  aria-label="Navn på lenken"
                  maxLength={40}
                />
              </div>
              <div className="min-w-0 flex-1">
                <input
                  className={inputClass}
                  value={link.url}
                  onChange={(e) => set("links", values.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
                  placeholder="https://"
                  type="url"
                  aria-label="Adresse"
                />
              </div>
              <button
                type="button"
                onClick={() => set("links", values.links.filter((_, j) => j !== i))}
                aria-label="Fjern lenken"
                className="shrink-0 rounded-lg px-3 text-mist hover:bg-white/5 hover:text-red-300"
              >
                ×
              </button>
            </div>
          ))}
          {err("links") && <p className="text-xs text-red-300">Sjekk at alle lenkene har navn og starter med https://</p>}
          {values.links.length < 10 && (
            <button
              type="button"
              onClick={() => set("links", [...values.links, { label: "", url: "" }])}
              className="text-sm text-ice hover:underline"
            >
              + Legg til lenke
            </button>
          )}
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-4 border-t border-line bg-ink/90 px-6 py-4 backdrop-blur">
        {message && <p className={`mr-auto text-sm ${message.type === "ok" ? "text-emerald-300" : "text-red-300"}`}>{message.text}</p>}
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg bg-ice px-5 py-2.5 font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Lagrer…" : "Lagre endringer"}
        </button>
      </div>
    </form>
  );
}
