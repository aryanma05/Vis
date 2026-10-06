import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { unsubscribeDigest, verifyUnsubscribe } from "@/lib/digest";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Meld av ukesoppsummeringen"), robots: { index: false } };
}

type Props = { searchParams: Promise<{ u?: string; t?: string; ferdig?: string }> };

// Lenken i ukesoppsummeringen. Avmeldingen skjer først når man trykker på knappen, så
// e-postprogrammer som åpner lenker automatisk ikke melder noen av ved et uhell.
export default async function UnsubscribePage({ searchParams }: Props) {
  const [{ u = "", t: token = "", ferdig }, t] = await Promise.all([searchParams, getT()]);
  const valid = Boolean(u && token && verifyUnsubscribe(u, token));

  async function unsubscribe() {
    "use server";
    if (!valid) return;
    await unsubscribeDigest(u);
    const { redirect } = await import("next/navigation");
    redirect(`/avmeld?u=${encodeURIComponent(u)}&t=${encodeURIComponent(token)}&ferdig=1`);
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-24 md:pl-24">
      <div className="max-w-md rounded-[28px] glass-card p-8 text-center">
        {!valid ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{t("Lenken virker ikke")}</h1>
            <p className="mt-3 text-mist">
              {t("Logg inn og slå av ukesoppsummeringen under")}{" "}
              <Link href="/profil/rediger/konto#varsler" className="text-ice hover:underline">
                {t("Konto og varsler")}
              </Link>
              .
            </p>
          </>
        ) : ferdig ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{t("Du er meldt av")}</h1>
            <p className="mt-3 text-mist">{t("Du får ikke flere ukesoppsummeringer. Du kan slå dem på igjen under Konto og varsler.")}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{t("Meld av ukesoppsummeringen?")}</h1>
            <p className="mt-3 text-mist">{t("Andre e-postvarsler endres ikke.")}</p>
            <form action={unsubscribe} className="mt-6">
              <Button type="submit">{t("Meld meg av")}</Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
