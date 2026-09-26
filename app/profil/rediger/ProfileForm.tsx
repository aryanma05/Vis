"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, ImagePlus, MapPin, Plus, Trash2, X } from "lucide-react";
import { removeAvatarAction, updateProfileAction, uploadAvatarAction } from "@/app/actions/profile";
import Avatar from "@/components/Avatar";
import MarkdownEditor from "@/components/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Field, inputClass, Section, textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { ACCENTS, ACCENT_KEYS, OPEN_TO, OPEN_TO_LABELS, type AccentKey, type OpenTo } from "@/lib/constants";
import { prepareImage } from "@/lib/prepare-image";

type Link = { label: string; url: string };
type CustomSection = { id: string; title: string; body: string };
export type ProfileValues = {
  name: string;
  headline: string;
  location: string;
  websiteUrl: string;
  bio: string;
  readme: string;
  lookingFor: string;
  openTo: OpenTo[];
  accentColor: AccentKey | null;
  links: Link[];
  customSections: CustomSection[];
};

const README_TEMPLATE = `## Hei! 👋

Kort om hvem du er og hva du brenner for.

### Det jeg jobber med nå
-

### Det jeg er god på
-

### Utenom jobb
`;

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ProfileForm({ initial, image, username }: { initial: ProfileValues; image: string | null; username: string }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [avatar, setAvatar] = useState(image);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const err = (key: string) => errors[key]?.[0];
  const accent = ACCENTS[values.accentColor ?? "is"];

  // Advar før man forlater siden med endringer som ikke er lagret.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      // Et profilbilde vises aldri større enn noen hundre piksler.
      const prepared = await prepareImage(file, { maxSide: 800 });
      const fd = new FormData();
      fd.append("avatar", prepared);
      const result = await uploadAvatarAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAvatar(result.data.url);
      toast.success("Profilbildet er oppdatert");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Opplastingen feilet. Prøv igjen.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    const result = await removeAvatarAction();
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setAvatar(null);
    router.refresh();
  }

  const save = () =>
    startTransition(async () => {
      const payload = {
        ...values,
        links: values.links.filter((l) => l.label.trim() || l.url.trim()),
        customSections: values.customSections.filter((s) => s.title.trim() || s.body.trim()),
      };
      const result = await updateProfileAction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setSaved(values);
      toast.success("Profilen er lagret");
      router.refresh();
    });

  const moveSection = (i: number, to: number) => {
    if (to < 0 || to >= values.customSections.length) return;
    const next = [...values.customSections];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    set("customSections", next);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="min-w-0">
        <Section title="Profilbilde" description="Et tydelig bilde av deg, eller en logo. Vises på visittkortet og ved alt du gjør.">
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={values.name || "?"} image={avatar} size={88} className="rounded-[26px]" />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
                <ImagePlus className="size-4" /> {avatar ? "Bytt bilde" : "Last opp bilde"}
              </Button>
              {avatar && (
                <Button variant="ghost" size="sm" onClick={removeAvatar} disabled={uploading}>
                  Fjern
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
                e.target.value = "";
              }}
            />
          </div>
        </Section>

        <Section title="Visittkortet" description="Det første folk ser når de åpner profilen din.">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Navn" error={err("name")}>
              <input className={inputClass} value={values.name} onChange={(e) => set("name", e.target.value)} required maxLength={100} />
            </Field>
            <Field label="Bosted" optional error={err("location")}>
              <input className={inputClass} value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="Oslo" maxLength={100} />
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
            <Field label="Kort om deg" optional hint="To–tre setninger. Vises øverst under «Om meg» og i CV-en." error={err("bio")} className="md:col-span-2">
              <textarea
                className={`${textareaClass} min-h-24`}
                value={values.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Hva jobber du med, hva er du nysgjerrig på, og hva ser du etter?"
                maxLength={600}
              />
            </Field>
          </div>
        </Section>

        <Section title="Aksentfarge" description="Fargen på profilen din – omslaget, merkene og CV-malene.">
          <div role="radiogroup" aria-label="Aksentfarge" className="flex flex-wrap gap-3">
            {ACCENT_KEYS.map((key) => {
              const on = (values.accentColor ?? "is") === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("accentColor", key)}
                  className={`group flex flex-col items-center gap-2 rounded-2xl border p-2.5 transition ${on ? "border-fg/60 bg-surface" : "border-line hover:border-mist/50"}`}
                >
                  <span className="flex size-10 items-center justify-center rounded-full" style={{ background: ACCENTS[key].color, color: ACCENTS[key].ink }}>
                    {on && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <span className="text-xs text-mist">{ACCENTS[key].label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Åpen for" description="Vis at du er tilgjengelig. Folk kan filtrere på dette i søket.">
          <div className="flex flex-wrap gap-2">
            {OPEN_TO.map((o) => {
              const on = values.openTo.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("openTo", on ? values.openTo.filter((x) => x !== o) : [...values.openTo, o])}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                    on ? "border-success/50 bg-success/10 text-success" : "border-line text-fg/90 hover:border-mist/50"
                  }`}
                >
                  {on ? <Check className="size-4" /> : <Plus className="size-4 text-mist" />}
                  {OPEN_TO_LABELS[o]}
                </button>
              );
            })}
          </div>
          <Field label="Hva ser du etter?" optional hint="Vises som et eget felt på profilen." error={err("lookingFor")} className="mt-6">
            <textarea
              className={`${textareaClass} min-h-20`}
              value={values.lookingFor}
              onChange={(e) => set("lookingFor", e.target.value)}
              placeholder="F.eks. «Deltidsjobb som frontendutvikler i Bergen fra januar»"
              maxLength={400}
            />
          </Field>
        </Section>

        <Section title="Om meg" description="En lengre README på profilen. Fortell historien din, hva du kan og hva du liker å jobbe med.">
          <MarkdownEditor
            value={values.readme}
            onChange={(v) => set("readme", v)}
            placeholder="Skriv om deg selv med markdown …"
            maxLength={10_000}
            template={README_TEMPLATE}
            templateLabel="Start med en mal"
            invalid={Boolean(err("readme"))}
          />
          {err("readme") && <p className="mt-1.5 text-[13px] text-danger">{err("readme")}</p>}
        </Section>

        <Section title="Lenker" description="Nettside, LinkedIn, GitHub, Dribbble eller noe annet folk bør se.">
          <div className="space-y-3">
            <Field label="Nettside" optional error={err("websiteUrl")}>
              <input className={inputClass} value={values.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://" inputMode="url" />
            </Field>
            {values.links.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={`${inputClass} w-32 shrink-0 sm:w-40`}
                  value={link.label}
                  onChange={(e) => set("links", values.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
                  placeholder="LinkedIn"
                  aria-label="Navn på lenken"
                  maxLength={40}
                />
                <input
                  className={`${inputClass} min-w-0 flex-1`}
                  value={link.url}
                  onChange={(e) => set("links", values.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
                  placeholder="https://"
                  inputMode="url"
                  aria-label="Adresse"
                />
                <Button variant="ghost" size="icon" aria-label="Fjern lenken" onClick={() => set("links", values.links.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            {Object.keys(errors).some((k) => k.startsWith("links")) && (
              <p className="text-[13px] text-danger">Sjekk at alle lenkene har navn og en gyldig adresse.</p>
            )}
            {values.links.length < 10 && (
              <Button variant="link" onClick={() => set("links", [...values.links, { label: "", url: "" }])}>
                <Plus className="size-4" /> Legg til lenke
              </Button>
            )}
          </div>
        </Section>

        <Section title="Egne seksjoner" description="Utmerkelser, publikasjoner, foredrag, frivillig arbeid … Hver seksjon får sin egen overskrift på profilen.">
          <div className="space-y-4">
            {values.customSections.map((s, i) => (
              <div key={s.id} className="rounded-2xl border border-line p-4">
                <div className="flex gap-2">
                  <input
                    className={`${inputClass} flex-1 font-semibold`}
                    value={s.title}
                    onChange={(e) => set("customSections", values.customSections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                    placeholder="Tittel, f.eks. «Utmerkelser»"
                    maxLength={60}
                    aria-label="Tittel på seksjonen"
                  />
                  <Button variant="ghost" size="icon" aria-label="Flytt opp" disabled={i === 0} onClick={() => moveSection(i, i - 1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Flytt ned" disabled={i === values.customSections.length - 1} onClick={() => moveSection(i, i + 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Fjern seksjonen" onClick={() => set("customSections", values.customSections.filter((x) => x.id !== s.id))} className="hover:text-danger">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <MarkdownEditor
                    value={s.body}
                    onChange={(v) => set("customSections", values.customSections.map((x) => (x.id === s.id ? { ...x, body: v } : x)))}
                    placeholder="- Vinner av NM i programmering 2025"
                    rows={5}
                    maxLength={5000}
                  />
                </div>
              </div>
            ))}
            {values.customSections.length < 8 && (
              <Button variant="secondary" size="sm" onClick={() => set("customSections", [...values.customSections, { id: newId(), title: "", body: "" }])}>
                <Plus className="size-4" /> Ny seksjon
              </Button>
            )}
          </div>
        </Section>

        <div className="sticky bottom-24 z-20 mt-2 flex items-center justify-end gap-4 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-[0_20px_40px_-24px_rgb(0_0_0/0.6)] backdrop-blur-xl md:bottom-6">
          <p className="mr-auto text-sm text-mist">{dirty ? "Du har endringer som ikke er lagret." : "Alt er lagret."}</p>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setValues(saved)}>
              Angre
            </Button>
          )}
          <Button type="submit" size="sm" loading={pending} disabled={!dirty}>
            Lagre profilen
          </Button>
        </div>
      </div>

      {/* Forhåndsvisning av visittkortet mens man skriver. */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 pt-10">
          <p className="label-mono">Forhåndsvisning</p>
          <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-surface/60">
            <div className="blueprint h-20" style={{ background: `radial-gradient(90% 140% at 90% 0%, color-mix(in srgb, ${accent.color} 45%, transparent), transparent 70%)` }} />
            <div className="-mt-10 px-5 pb-5">
              <Avatar name={values.name || "?"} image={avatar} size={72} className="rounded-[22px] ring-4 ring-surface" />
              <p className="mt-3 truncate text-lg font-bold tracking-tight">{values.name || "Navnet ditt"}</p>
              <p className="text-sm text-mist">@{username}</p>
              {values.headline && <p className="mt-2 text-sm leading-6 text-fg">{values.headline}</p>}
              {values.location && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-mist">
                  <MapPin className="size-3.5" /> {values.location}
                </p>
              )}
              {values.openTo.length > 0 && (
                <p className="mt-3 rounded-xl border border-success/25 bg-success/[0.07] px-3 py-2 text-xs text-success">
                  Åpen for: {values.openTo.map((o) => OPEN_TO_LABELS[o]).join(", ")}
                </p>
              )}
              <div className="mt-4 h-1.5 w-16 rounded-full" style={{ background: accent.color }} />
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
