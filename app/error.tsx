"use client";

import { useEffect } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-client-error";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-24 md:pl-24">
      <div className="max-w-lg text-center">
        <p className="caption">{t("Noe gikk galt")}</p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">{t("Siden kunne ikke lastes")}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-mist">
          {t("Det er ikke deg, det er oss. Prøv igjen om et øyeblikk. Fortsetter det, gå tilbake til forsiden.")}
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-mist/60">{t("Feilkode: {code}", { code: error.digest })}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>{t("Prøv igjen")}</Button>
          <ButtonLink href="/" variant="secondary">
            {t("Til forsiden")}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
