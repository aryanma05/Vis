import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Fant ikke siden"), robots: { index: false } };
}

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-24 md:pl-24">
      <div className="max-w-xl text-center">
        <p className="caption">404</p>
        <h1 className="mt-3 display text-[clamp(2.5rem,7vw,4rem)] text-fg">{t("Her var det tomt.")}</h1>
        <p className="mx-auto mt-4 max-w-md text-lg leading-8 text-mist">
          {t("Siden finnes ikke, eller lenken er feil. Kanskje profilen har byttet brukernavn?")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">{t("Til forsiden")}</ButtonLink>
          <ButtonLink href="/sok" variant="secondary">
            {t("Utforsk prosjekter")}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
