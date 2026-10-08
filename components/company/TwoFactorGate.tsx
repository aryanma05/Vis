import { ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

// Vises i stedet for fanen når bedriften krever tofaktor og personen ikke har slått det på.
export default async function TwoFactorGate() {
  const t = await getT();
  return (
    <section className="mx-auto max-w-xl rounded-[22px] glass-card p-6 text-center md:p-8">
      <div className="glass-chip mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <ShieldCheck className="size-5 text-success" />
      </div>
      <h2 className="text-lg font-semibold">{t("Bedriften krever tofaktorinnlogging")}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-6 text-mist">
        {t("For å beskytte søkerne må alle i bedriften ha to-trinns innlogging. Slå det på under Konto, så får du tilgang igjen med en gang.")}
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/profil/rediger/konto#to-trinn" size="sm">
          {t("Slå på to-trinns innlogging")}
        </ButtonLink>
      </div>
    </section>
  );
}
