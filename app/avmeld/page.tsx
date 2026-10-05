import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { unsubscribeDigest, verifyUnsubscribe } from "@/lib/digest";

export const metadata: Metadata = { title: "Meld av ukesoppsummeringen", robots: { index: false } };

type Props = { searchParams: Promise<{ u?: string; t?: string; ferdig?: string }> };

// Lenken i ukesoppsummeringen. Avmeldingen skjer først når man trykker på knappen, så
// e-postprogrammer som åpner lenker automatisk ikke melder noen av ved et uhell.
export default async function UnsubscribePage({ searchParams }: Props) {
  const { u = "", t = "", ferdig } = await searchParams;
  const valid = Boolean(u && t && verifyUnsubscribe(u, t));

  async function unsubscribe() {
    "use server";
    if (!valid) return;
    await unsubscribeDigest(u);
    const { redirect } = await import("next/navigation");
    redirect(`/avmeld?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}&ferdig=1`);
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-24 md:pl-24">
      <div className="max-w-md rounded-[28px] glass-card p-8 text-center">
        {!valid ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Lenken virker ikke</h1>
            <p className="mt-3 text-mist">
              Logg inn og slå av ukesoppsummeringen under{" "}
              <Link href="/profil/rediger/konto#varsler" className="text-ice hover:underline">
                Konto og varsler
              </Link>
              .
            </p>
          </>
        ) : ferdig ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Du er meldt av</h1>
            <p className="mt-3 text-mist">Du får ikke flere ukesoppsummeringer. Du kan slå dem på igjen under Konto og varsler.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Meld av ukesoppsummeringen?</h1>
            <p className="mt-3 text-mist">Andre e-postvarsler endres ikke.</p>
            <form action={unsubscribe} className="mt-6">
              <Button type="submit">Meld meg av</Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
