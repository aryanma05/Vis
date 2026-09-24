import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/form";
import { getAccountInfo } from "@/lib/account";
import { isEmailEnabled } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import EditNav from "../EditNav";
import { ChangePassword, DeleteAccount, EmailStatus } from "./AccountForms";

export const metadata = { title: "Konto og personvern – vis" };

export default async function AccountPage() {
  const user = await requireUser();
  const info = await getAccountInfo(user.id);
  if (!info) notFound();

  return (
    <main className="min-h-screen pb-28 md:pb-16 md:pl-28 md:pr-10">
      <EditNav active="konto" username={user.username} />
      <div className="mx-auto max-w-5xl px-6">
        <Section title="E-post" description="Brukes bare til innlogging og viktige beskjeder. Den vises aldri for andre.">
          <EmailStatus email={info.email} verified={info.emailVerified} canSend={isEmailEnabled} />
        </Section>

        {info.hasPassword && (
          <Section title="Passord" description="Når du bytter passord, logges du ut på alle andre enheter.">
            <ChangePassword />
          </Section>
        )}

        <Section title="Dataene dine" description="Du bestemmer over det du har lagt ut på Vis.">
          <ul className="space-y-3 text-sm">
            <li>
              <a href="/api/mine-data" className="font-medium text-ice hover:underline">
                Last ned alt vi har lagret om deg
              </a>
              <span className="text-mist"> (JSON-fil med profil, prosjekter, CV og kommentarer)</span>
            </li>
            <li>
              <Link href="/profil/rediger/cv" className="font-medium text-ice hover:underline">
                Skjul eller fjern CV-en
              </Link>
              <span className="text-mist"> (en skjult CV kan bare du se)</span>
            </li>
            <li>
              <Link href="/personvern" className="font-medium text-ice hover:underline">
                Les hvordan vi behandler personopplysninger
              </Link>
            </li>
          </ul>
        </Section>

        <Section title="Slett kontoen" description="Sletter profilen, alle prosjekter og bilder, CV-en og kommentarene dine for godt.">
          <DeleteAccount hasPassword={info.hasPassword} />
        </Section>
      </div>
    </main>
  );
}
