"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, KeyRound, Send, ShieldCheck, Trash2, Webhook } from "lucide-react";
import { setWebhookActiveAction, setWebhookPersonalDataAction } from "@/app/actions/company-privacy";
import { createApiKeyAction, createWebhookAction, deleteWebhookAction, revokeApiKeyAction, testWebhookAction } from "@/app/actions/developers";
import { useLocale, useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { inputClass } from "@/components/ui/field";
import Switch from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { dateLocale } from "@/lib/i18n";

function Secret({ label, value, note }: { label: string; value: string; note: string }) {
  const t = useT();
  return (
    <div className="rounded-2xl bg-success/10 p-4">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-ink-2 px-3 py-2 font-mono text-xs">{value}</code>
        <Button size="xs" variant="secondary" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Kopiert"))} aria-label={t("Kopier")}>
          <Copy className="size-3.5" />
        </Button>
      </div>
      <p className="mt-2 text-xs text-mist">{note}</p>
    </div>
  );
}

type Key = { id: string; name: string; prefix: string; lastUsedAt: Date | null; createdAt: Date };

export function ApiKeys({ keys }: { keys: Key[] }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-mist">
        {t("Med en nøkkel får du høyere grense i")}{" "}
        <a href="/utviklere" className="text-ice hover:underline">
          {t("API-et")}
        </a>{" "}
        {t("(1 200 kall i minuttet i stedet for 120). Nøkkelen vises bare én gang.")}
      </p>
      {created && (
        <Secret label={t("Den nye nøkkelen din")} value={created} note={t("Kopier den nå. Vi lagrer bare en hash, så den kan ikke vises igjen.")} />
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await createApiKeyAction(name);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setCreated(result.data.key);
            setName("");
            router.refresh();
          });
        }}
      >
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Navn, f.eks. «Porteføljesiden min»")} maxLength={60} aria-label={t("Navn på nøkkelen")} />
        <Button type="submit" size="sm" loading={pending}>
          <KeyRound className="size-4" /> {t("Lag nøkkel")}
        </Button>
      </form>
      {keys.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] glass-card">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{k.name}</p>
                <p className="font-mono text-xs text-mist">
                  {k.prefix}… ·{" "}
                  {k.lastUsedAt ? t("sist brukt {date}", { date: new Date(k.lastUsedAt).toLocaleDateString(dateLocale(locale)) }) : t("ikke brukt")}
                </p>
              </div>
              <Button
                size="xs"
                variant="ghost"
                className="hover:text-danger"
                onClick={() =>
                  start(async () => {
                    if (!window.confirm(t("Slette nøkkelen? Det som bruker den slutter å virke."))) return;
                    const result = await revokeApiKeyAction(k.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    router.refresh();
                  })
                }
                aria-label={t("Slett nøkkelen")}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Hook = {
  id: string;
  url: string;
  events: string[];
  lastStatus: number | null;
  lastDeliveryAt: Date | null;
  secretHint: string;
  active: boolean;
  includePersonalData: boolean;
  createdByName: string | null;
};

// Webhooks for bedrifter (bare eier og administratorer ser dem). Kandidatens navn, e-post og
// melding sendes bare når det er slått på for webhooken; ingenting sendes uten Bedrift.
export function Webhooks({ companyId, hooks, events, canManage }: { companyId: string; hooks: Hook[]; events: Record<string, string>; canManage: boolean }) {
  const router = useRouter();
  const t = useT();
  const [url, setUrl] = useState("");
  const [chosen, setChosen] = useState<string[]>(Object.keys(events));
  const [secret, setSecret] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Hook | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? t("Noe gikk galt."));
      if (done) toast.success(done);
      router.refresh();
    });

  return (
    <div className="max-w-2xl space-y-5">
      {secret && (
        <Secret label={t("Signeringshemmeligheten")} value={secret} note={t("Bruk den til å sjekke Vis-Signature på hver levering. Den vises bare nå.")} />
      )}
      {canManage && (
        <form
          className="space-y-3 rounded-[22px] glass-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await createWebhookAction(companyId, { url, events: chosen });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setSecret(result.data.secret);
              setUrl("");
              router.refresh();
            });
          }}
        >
          <p className="flex items-center gap-2 font-medium">
            <Webhook className="size-4 text-mist" /> {t("Ny webhook")}
          </p>
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://dittsystem.no/vis-webhook" aria-label={t("Adresse")} />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(events).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(key)}
                  onChange={(e) => setChosen((c) => (e.target.checked ? [...c, key] : c.filter((x) => x !== key)))}
                  className="size-4 accent-[var(--sea)]"
                />
                {t(label)} <code className="font-mono text-xs text-mist">{key}</code>
              </label>
            ))}
          </div>
          <p className="flex items-start gap-2 text-xs text-mist">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            {t("Uten persondata: stillingen og søknadens status sendes, men ikke kandidatens navn, e-post eller melding. Slå det på per webhook når mottakeren trenger det.")}
          </p>
          <Button type="submit" size="sm" loading={pending} disabled={!url.trim() || chosen.length === 0}>
            {t("Legg til")}
          </Button>
        </form>
      )}
      {hooks.length === 0 ? (
        <p className="text-sm text-mist">{t("Ingen webhooks ennå.")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
          {hooks.map((h) => (
            <li key={h.id} className={`px-5 py-4 text-sm ${h.active ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-mono text-[13px]">{h.url}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${h.active ? "bg-success/15 text-success" : "bg-fill text-mist"}`}>
                      {h.active ? t("Aktiv") : t("Av")}
                    </span>
                    {h.includePersonalData && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">{t("med persondata")}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-mist">
                    {h.events.join(", ")} ·{" "}
                    {h.lastDeliveryAt ? (
                      <span className={h.lastStatus && h.lastStatus < 300 ? "text-success" : "text-danger"}>
                        {h.lastStatus ? t("sist {status}", { status: h.lastStatus }) : t("sist feilet")}
                      </span>
                    ) : (
                      t("ingen leveringer ennå")
                    )}
                    {h.createdByName && ` · ${t("lagt til av {name}", { name: h.createdByName })}`}
                  </p>
                </div>
                {canManage && (
                  <>
                    <Button
                      size="xs"
                      variant="secondary"
                      loading={pending}
                      disabled={!h.active}
                      onClick={() =>
                        start(async () => {
                          const result = await testWebhookAction(h.id);
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          if (result.data.ok) toast.success(t("Mottatt ({status})", { status: result.data.status ?? "" }));
                          else
                            toast.error(
                              result.data.status ? t("Mottakeren svarte {status}", { status: result.data.status }) : t("Fikk ikke kontakt med adressen"),
                            );
                          router.refresh();
                        })
                      }
                    >
                      <Send className="size-3.5" /> Test
                    </Button>
                    <Button size="xs" variant="ghost" className="hover:text-danger" onClick={() => setRemoving(h)} aria-label={t("Slett")}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
              {canManage && (
                <div className="mt-3 grid gap-3 rounded-[14px] bg-fill p-3 sm:grid-cols-2">
                  <Switch
                    checked={h.active}
                    disabled={pending}
                    onChange={(on) => run(() => setWebhookActiveAction(h.id, on), on ? t("Webhooken er slått på") : t("Webhooken er slått av"))}
                    label={t("Aktiv")}
                    description={h.active ? t("Sender hendelser nå.") : t("Den som slår den på, blir ansvarlig for den.")}
                  />
                  <Switch
                    checked={h.includePersonalData}
                    disabled={pending}
                    onChange={(on) => run(() => setWebhookPersonalDataAction(h.id, on), on ? t("Persondata sendes med") : t("Persondata sendes ikke lenger"))}
                    label={t("Ta med persondata")}
                    description={t("Kandidatens navn, e-post, profil og melding.")}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={removing !== null} onClose={() => setRemoving(null)} size="sm" title={t("Slette webhooken?")} description={removing ? t("Ingenting sendes til {host} lenger.", { host: hostOf(removing.url) }) : undefined}>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>
            {t("Avbryt")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={pending}
            onClick={() => {
              const hook = removing;
              setRemoving(null);
              if (hook) run(() => deleteWebhookAction(hook.id), t("Webhooken er slettet"));
            }}
          >
            {t("Slett")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
