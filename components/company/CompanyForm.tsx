"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Building2, ImagePlus } from "lucide-react";
import { createCompanyAction, deleteCompanyAction, updateCompanyAction, uploadCompanyLogoAction } from "@/app/actions/companies";
import { useT } from "@/components/LocaleProvider";
import MarkdownEditor from "@/components/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Field, inputClass, labelClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { COMPANY_SIZES } from "@/lib/company-labels";
import { prepareImage } from "@/lib/prepare-image";

export type CompanyValues = { name: string; website: string; location: string; size: string; about: string };

// Lag eller rediger en bedriftsside.
export default function CompanyForm({
  companyId,
  initial = { name: "", website: "", location: "", size: "", about: "" },
  logoUrl = null,
  canDelete = false,
}: {
  companyId?: string;
  initial?: CompanyValues;
  logoUrl?: string | null;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [values, setValues] = useState(initial);
  const [logo, setLogo] = useState(logoUrl);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (key: keyof CompanyValues, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    start(async () => {
      if (companyId) {
        const result = await updateCompanyAction(companyId, values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Lagret");
        router.refresh();
      } else {
        const result = await createCompanyAction({ ...values, acceptTerms });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        router.push(`/bedrift/${result.data.slug}/admin`);
      }
    });
  };

  async function uploadLogo(file: File) {
    if (!companyId) return;
    setUploading(true);
    try {
      const prepared = await prepareImage(file);
      const fd = new FormData();
      fd.append("logo", prepared);
      const result = await uploadCompanyLogoAction(companyId, fd);
      if (!result.ok) throw new Error(result.error);
      setLogo(result.data.url);
      toast.success("Logoen er lagret");
    } catch (error) {
      toast.error((error as Error).message || t("Klarte ikke å laste opp logoen."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      {companyId && (
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-fill">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" className="size-full object-cover" /> : <Building2 className="size-6 text-mist" />}
          </span>
          <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" /> {logo ? t("Bytt logo") : t("Last opp logo")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) uploadLogo(file);
            }}
          />
        </div>
      )}
      <Field label={t("Navn")}>
        <input
          className={inputClass}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={80}
          required
          placeholder={t("F.eks. Fjordkode AS")}
        />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("Nettside")} optional>
          <input className={inputClass} value={values.website} onChange={(e) => set("website", e.target.value)} placeholder="fjordkode.no" />
        </Field>
        <Field label={t("Sted")} optional>
          <input className={inputClass} value={values.location} onChange={(e) => set("location", e.target.value)} maxLength={100} placeholder="Bergen" />
        </Field>
      </div>
      <fieldset>
        <legend className={labelClass}>
          {t("Størrelse")} <span className="font-normal text-mist">({t("valgfritt")})</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {COMPANY_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={values.size === s}
              onClick={() => set("size", values.size === s ? "" : s)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${values.size === s ? "bg-primary text-on-primary" : "glass-chip text-fg"}`}
            >
              {t("{n} ansatte", { n: s })}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={t("Om bedriften")} optional hint={t("Hva dere lager, hvordan dere jobber og hva slags folk dere ser etter.")} htmlFor="bedrift-om">
        <MarkdownEditor id="bedrift-om" value={values.about} onChange={(v) => set("about", v)} maxLength={5000} placeholder={t("Skriv om bedriften …")} />
      </Field>
      {!companyId && (
        <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-[18px] glass-card p-4 text-sm">
          <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 accent-[var(--sea)]" />
          <span className="text-mist">
            {t("Jeg har rett til å representere bedriften og godtar")}{" "}
            <Link href="/vilkar#bedrifter" target="_blank" className="text-ice hover:underline">
              {t("reglene for bedrifter")}
            </Link>{" "}
            {t("og")}{" "}
            <Link href="/vilkar/databehandleravtale" target="_blank" className="text-ice hover:underline">
              {t("databehandleravtalen")}
            </Link>
            .
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {companyId ? t("Lagre") : t("Lag bedriftsside")}
        </Button>
        {companyId && canDelete && (
          <Button
            type="button"
            variant="ghost"
            className="hover:text-danger"
            onClick={() =>
              start(async () => {
                if (!window.confirm(t("Slette bedriftssiden med alle stillinger og lister? Dette kan ikke angres."))) return;
                const result = await deleteCompanyAction(companyId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                router.push("/bedrifter");
              })
            }
          >
            {t("Slett bedriften")}
          </Button>
        )}
      </div>
    </form>
  );
}
