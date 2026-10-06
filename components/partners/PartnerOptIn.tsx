"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EyeOff, Handshake } from "lucide-react";
import { setPartnerStatusAction } from "@/app/actions/partners";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

const MAX = 400;

// Kortet øverst på partnersiden: bli synlig her, skriv hva du vil lage, eller skjul deg.
// Lagres som «Samarbeid» under «Åpen for» og «Hva ser du etter?» på profilen.
export default function PartnerOptIn({ listed, lookingFor: initial }: { listed: boolean; lookingFor: string }) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  const changed = text.trim() !== initial.trim();

  const save = (nextListed: boolean, message: string) =>
    start(async () => {
      const result = await setPartnerStatusAction({ listed: nextListed, lookingFor: text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      router.refresh();
    });

  return (
    <section className="rounded-[22px] glass-card p-5" aria-labelledby="partner-meg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="partner-meg" className="flex items-center gap-2 font-semibold">
          <Handshake className="size-4 text-ice" aria-hidden="true" />
          {listed ? t("Du står på listen") : t("Vil du bli funnet?")}
        </h2>
        {listed && (
          <Button variant="ghost" size="sm" loading={pending && !changed} onClick={() => save(false, t("Du er skjult fra partnersiden"))}>
            <EyeOff className="size-4" /> {t("Skjul meg")}
          </Button>
        )}
      </div>
      <label htmlFor="partner-tekst" className="sr-only">
        {t("Hva vil du lage?")}
      </label>
      <textarea
        id="partner-tekst"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX}
        rows={2}
        placeholder={t("Hva vil du lage? F.eks. «En app for turlag – ser etter en designer»")}
        className={`${textareaClass} mt-3 min-h-20`}
      />
      <div className="mt-3 flex justify-end">
        {listed ? (
          changed && (
            <Button size="sm" loading={pending} onClick={() => save(true, t("Lagret"))}>
              {t("Lagre")}
            </Button>
          )
        ) : (
          <Button size="sm" loading={pending} onClick={() => save(true, t("Nå kan andre finne deg her"))}>
            <Handshake className="size-4" /> {t("Vis meg her")}
          </Button>
        )}
      </div>
    </section>
  );
}
