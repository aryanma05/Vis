"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Globe2 } from "lucide-react";
import { removeCustomDomainAction, setCustomDomainAction, setProfileFlagsAction, verifyCustomDomainAction } from "@/app/actions/pro";
import { useT } from "@/components/LocaleProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import Switch from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

type Domain = { domain: string; token: string; verified: boolean } | null;

export function VisitPrivacy({ initial }: { initial: { hideVisits: boolean } }) {
  const t = useT();
  const [hide, setHide] = useState(initial.hideVisits);
  return (
    <div className="max-w-lg">
      <Switch
        checked={!hide}
        onChange={async (visible) => {
          setHide(!visible);
          const result = await setProfileFlagsAction({ hideVisits: !visible });
          if (!result.ok) {
            setHide(hide);
            toast.error(result.error);
            return;
          }
          toast.success("Lagret");
        }}
        label={t("Vis meg når jeg ser på andres profiler")}
        description={t("Pro-brukere ser hvem som har besøkt dem. Slår du dette av, er du anonym – men da ser du heller ikke selv hvem som har sett din profil.")}
      />
    </div>
  );
}

export function ProSettings({ isPro, hideBranding, domain, appHost }: { isPro: boolean; hideBranding: boolean; domain: Domain; appHost: string }) {
  const router = useRouter();
  const t = useT();
  const [branding, setBranding] = useState(hideBranding);
  const [input, setInput] = useState(domain?.domain ?? "");
  const [pending, setPending] = useState(false);

  if (!isPro) {
    return (
      <div className="max-w-lg rounded-[18px] glass-card p-5">
        <p className="font-medium">{t("Eget domene og uten Vis-merket")}</p>
        <p className="mt-1 text-sm text-mist">{t("Med Pro kan profilen ligge på ditt eget domene, og «Laget med Vis» forsvinner fra CV-en og innbyggingskortene.")}</p>
        <ButtonLink href="/priser" size="sm" className="mt-4">
          {t("Se Pro")}
        </ButtonLink>
      </div>
    );
  }

  async function saveDomain(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await setCustomDomainAction(input);
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    router.refresh();
  }

  async function verify() {
    setPending(true);
    const result = await verifyCustomDomainAction();
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Domenet er bekreftet", {
      description: result.data.pointsHere ? t("Det kan ta litt tid før HTTPS-sertifikatet er klart.") : t("Husk å la domenet peke til Vis (se steg 2)."),
    });
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-8">
      <Switch
        checked={branding}
        onChange={async (on) => {
          setBranding(on);
          const result = await setProfileFlagsAction({ hideBranding: on });
          if (!result.ok) {
            setBranding(!on);
            toast.error(result.error);
            return;
          }
          toast.success("Lagret");
        }}
        label={t("Skjul «Laget med Vis»")}
        description={t("Gjelder CV-en (også som PDF) og kortene du bygger inn på andre nettsider.")}
      />

      <div>
        <p className="flex items-center gap-2 font-medium">
          <Globe2 className="size-4 text-mist" /> {t("Eget domene")}
        </p>
        {!domain ? (
          <form onSubmit={saveDomain} className="mt-3 flex gap-2">
            <label htmlFor="domene" className="sr-only">
              {t("Domene")}
            </label>
            <input id="domene" className={inputClass} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("dittnavn.no")} autoCapitalize="none" spellCheck={false} />
            <Button type="submit" size="sm" loading={pending} disabled={!input.trim()}>
              {t("Legg til")}
            </Button>
          </form>
        ) : (
          <div className="mt-3 rounded-[18px] glass-card p-5 text-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="font-mono text-[15px]">{domain.domain}</span>
              {domain.verified ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-4" /> {t("Bekreftet")}
                </span>
              ) : (
                <span className="text-warn">{t("Ikke bekreftet")}</span>
              )}
            </p>
            {!domain.verified && (
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-mist">
                <li>
                  {t("Legg inn en TXT-post hos domeneleverandøren din:")}
                  <span className="mt-1 block break-all rounded-lg bg-ink-2 px-3 py-2 font-mono text-xs text-fg">
                    _vis.{domain.domain} TXT vis-verify={domain.token}
                  </span>
                </li>
                <li>
                  {t("La domenet peke til Vis med en CNAME-post (eller ALIAS for rotdomener):")}
                  <span className="mt-1 block break-all rounded-lg bg-ink-2 px-3 py-2 font-mono text-xs text-fg">
                    {domain.domain} CNAME {appHost}
                  </span>
                </li>
                <li>{t("Trykk «Sjekk». Når domenet er bekreftet, kobler vi det til og lager HTTPS-sertifikat (vanligvis innen et døgn).")}</li>
              </ol>
            )}
            {domain.verified && <p className="mt-3 text-mist">{t("{domain} viser profilen din, og {domain}/cv viser CV-en.", { domain: domain.domain })}</p>}
            <div className="mt-4 flex gap-2">
              {!domain.verified && (
                <Button size="sm" onClick={verify} loading={pending}>
                  {t("Sjekk")}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="hover:text-danger"
                onClick={async () => {
                  const result = await removeCustomDomainAction();
                  if (!result.ok) return toast.error(result.error);
                  setInput("");
                  router.refresh();
                }}
              >
                {t("Fjern domenet")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
