"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, KeyRound, Send, Trash2, Webhook } from "lucide-react";
import { createApiKeyAction, createWebhookAction, deleteWebhookAction, revokeApiKeyAction, testWebhookAction } from "@/app/actions/developers";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

function Secret({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl bg-success/10 p-4">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-ink-2 px-3 py-2 font-mono text-xs">{value}</code>
        <Button size="xs" variant="secondary" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Kopiert"))} aria-label="Kopier">
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
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-mist">
        Med en nøkkel får du høyere grense i <a href="/utviklere" className="text-ice hover:underline">API-et</a> (1 200 kall i minuttet i stedet for 120). Nøkkelen vises bare én gang.
      </p>
      {created && <Secret label="Den nye nøkkelen din" value={created} note="Kopier den nå. Vi lagrer bare en hash, så den kan ikke vises igjen." />}
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
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn, f.eks. «Porteføljesiden min»" maxLength={60} aria-label="Navn på nøkkelen" />
        <Button type="submit" size="sm" loading={pending}>
          <KeyRound className="size-4" /> Lag nøkkel
        </Button>
      </form>
      {keys.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] glass-card">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{k.name}</p>
                <p className="font-mono text-xs text-mist">
                  {k.prefix}… · {k.lastUsedAt ? `sist brukt ${new Date(k.lastUsedAt).toLocaleDateString("nb-NO")}` : "ikke brukt"}
                </p>
              </div>
              <Button
                size="xs"
                variant="ghost"
                className="hover:text-danger"
                onClick={() =>
                  start(async () => {
                    if (!window.confirm("Slette nøkkelen? Det som bruker den slutter å virke.")) return;
                    const result = await revokeApiKeyAction(k.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    router.refresh();
                  })
                }
                aria-label="Slett nøkkelen"
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

type Hook = { id: string; url: string; events: string[]; lastStatus: number | null; lastDeliveryAt: Date | null; secretHint: string };

export function Webhooks({ companyId, hooks, events, canManage }: { companyId: string; hooks: Hook[]; events: Record<string, string>; canManage: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [chosen, setChosen] = useState<string[]>(Object.keys(events));
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="max-w-2xl space-y-5">
      {secret && <Secret label="Signeringshemmeligheten" value={secret} note="Bruk den til å sjekke Vis-Signature på hver levering. Den vises bare nå." />}
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
            <Webhook className="size-4 text-mist" /> Ny webhook
          </p>
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://dittsystem.no/vis-webhook" aria-label="Adresse" />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(events).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(key)}
                  onChange={(e) => setChosen((c) => (e.target.checked ? [...c, key] : c.filter((x) => x !== key)))}
                  className="size-4 accent-[var(--sea)]"
                />
                {label} <code className="font-mono text-xs text-mist">{key}</code>
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" loading={pending} disabled={!url.trim() || chosen.length === 0}>
            Legg til
          </Button>
        </form>
      )}
      {hooks.length === 0 ? (
        <p className="text-sm text-mist">Ingen webhooks ennå.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
          {hooks.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px]">{h.url}</p>
                <p className="mt-0.5 text-xs text-mist">
                  {h.events.join(", ")} ·{" "}
                  {h.lastDeliveryAt ? (
                    <span className={h.lastStatus && h.lastStatus < 300 ? "text-success" : "text-danger"}>sist {h.lastStatus || "feilet"}</span>
                  ) : (
                    "ingen leveringer ennå"
                  )}
                </p>
              </div>
              {canManage && (
                <>
                  <Button
                    size="xs"
                    variant="secondary"
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await testWebhookAction(h.id);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        if (result.data.ok) toast.success(`Mottatt (${result.data.status})`);
                        else toast.error(result.data.status ? `Mottakeren svarte ${result.data.status}` : "Fikk ikke kontakt med adressen");
                        router.refresh();
                      })
                    }
                  >
                    <Send className="size-3.5" /> Test
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="hover:text-danger"
                    onClick={() =>
                      start(async () => {
                        if (!window.confirm("Slette webhooken?")) return;
                        const result = await deleteWebhookAction(h.id);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        router.refresh();
                      })
                    }
                    aria-label="Slett"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
