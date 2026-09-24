"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Printer } from "lucide-react";
import { setCvTemplateAction } from "@/app/actions/profile";
import ShareButton from "@/components/social/ShareButton";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { CV_TEMPLATE_LABELS, CV_TEMPLATES, type CvTemplate } from "@/lib/constants";

// Verktøylinjen over den delbare CV-en: velg mal, lagre som standard, skriv ut / PDF.
export default function CvToolbar({
  username,
  name,
  template,
  savedTemplate,
  isOwner,
  autoPrint,
}: {
  username: string;
  name: string;
  template: CvTemplate;
  savedTemplate: CvTemplate;
  isOwner: boolean;
  autoPrint: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(savedTemplate);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  const choose = (next: CvTemplate) => router.replace(`/@${username}/cv${next === saved ? "" : `?mal=${next}`}`, { scroll: false });

  const save = () =>
    startTransition(async () => {
      const result = await setCvTemplateAction(template);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(template);
      toast.success(`${CV_TEMPLATE_LABELS[template].name} er nå malen på profilen din`);
      router.replace(`/@${username}/cv`, { scroll: false });
    });

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/@${username}?fane=cv`} className="inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> Tilbake til {name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton path={`/@${username}/cv`} title={`CV-en til ${name}`} label="Del CV" />
          <Button
            size="sm"
            onClick={() => {
              toast.info("Velg «Lagre som PDF» i utskriftsvinduet");
              window.print();
            }}
          >
            <Printer className="size-4" /> Last ned PDF
          </Button>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented
          label="CV-mal"
          value={template}
          onChange={choose}
          options={CV_TEMPLATES.map((t) => ({ value: t, label: CV_TEMPLATE_LABELS[t].name }))}
        />
        <p className="text-sm text-mist">{CV_TEMPLATE_LABELS[template].description}</p>
        {isOwner && template !== saved && (
          <Button size="sm" variant="secondary" onClick={save} loading={pending}>
            <Check className="size-4" /> Bruk på profilen
          </Button>
        )}
      </div>
    </div>
  );
}
