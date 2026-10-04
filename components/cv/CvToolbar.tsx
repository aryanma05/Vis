"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Printer } from "lucide-react";
import { setCvTemplateAction } from "@/app/actions/profile";
import { useLocale, useT } from "@/components/LocaleProvider";
import ShareMenu from "@/components/social/ShareMenu";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { CV_TEMPLATE_LABELS, CV_TEMPLATES, type CvTemplate } from "@/lib/constants";
import type { Locale } from "@/lib/i18n";

// Verktøylinjen over den delbare CV-en: velg mal, lagre som standard, skriv ut / PDF.
export default function CvToolbar({
  username,
  name,
  template,
  savedTemplate,
  isOwner,
  ownerPro = false,
  autoPrint,
  cvLocale,
}: {
  username: string;
  name: string;
  template: CvTemplate;
  savedTemplate: CvTemplate;
  isOwner: boolean;
  ownerPro?: boolean;
  autoPrint: boolean;
  cvLocale: Locale;
}) {
  const t = useT();
  const uiLocale = useLocale();
  // Besøkende ser bare Pro-malene når eieren har Pro.
  const templates = CV_TEMPLATES.filter((name) => isOwner || ownerPro || !CV_TEMPLATE_LABELS[name].pro);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(savedTemplate);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  // Malen og språket står i adressen, så lenken kan deles slik den ser ut.
  const go = ({ mal = template, sprak = cvLocale }: { mal?: CvTemplate; sprak?: Locale }) => {
    const params = new URLSearchParams();
    if (mal !== saved) params.set("mal", mal);
    if (sprak !== uiLocale) params.set("sprak", sprak);
    const query = params.toString();
    router.replace(`/@${username}/cv${query ? `?${query}` : ""}`, { scroll: false });
  };
  const choose = (mal: CvTemplate) => go({ mal });

  const save = () =>
    startTransition(async () => {
      const result = await setCvTemplateAction(template);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(template);
      toast.success(t("{name} er nå malen på profilen din", { name: t(CV_TEMPLATE_LABELS[template].name) }));
      router.replace(`/@${username}/cv${cvLocale !== uiLocale ? `?sprak=${cvLocale}` : ""}`, { scroll: false });
    });

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/@${username}?fane=cv`} className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Tilbake til {name}", { name })}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ShareMenu path={`/@${username}/cv`} title={t("CV-en til {name}", { name })} kind="cv" username={username} label={t("Del CV")} />
          <Button
            size="sm"
            onClick={() => {
              toast.info(t("Velg «Lagre som PDF» i utskriftsvinduet"));
              window.print();
            }}
          >
            <Printer className="size-4" /> {t("Last ned PDF")}
          </Button>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented
          label={t("CV-mal")}
          value={template}
          onChange={choose}
          options={templates.map((name) => ({ value: name, label: CV_TEMPLATE_LABELS[name].pro && !ownerPro ? `${t(CV_TEMPLATE_LABELS[name].name)} ✦` : t(CV_TEMPLATE_LABELS[name].name) }))}
        />
        <Segmented
          label={t("Språk på CV-en")}
          value={cvLocale}
          onChange={(sprak: Locale) => go({ sprak })}
          options={[
            { value: "nb", label: "Norsk" },
            { value: "en", label: "English" },
          ]}
        />
        <p className="text-sm text-mist">
          {t(CV_TEMPLATE_LABELS[template].description)}
          {isOwner && CV_TEMPLATE_LABELS[template].pro && !ownerPro && (
            <>
              {" "}
              <Link href="/priser" className="text-ice hover:underline">
                {t("Krever Pro")}
              </Link>
            </>
          )}
        </p>
        {isOwner && template !== saved && (!CV_TEMPLATE_LABELS[template].pro || ownerPro) && (
          <Button size="sm" variant="secondary" onClick={save} loading={pending}>
            <Check className="size-4" /> {t("Bruk på profilen")}
          </Button>
        )}
      </div>
    </div>
  );
}
