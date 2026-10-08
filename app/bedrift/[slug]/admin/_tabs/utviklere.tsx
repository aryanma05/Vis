import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import Upsell from "@/components/company/Upsell";
import { Webhooks } from "@/components/developers/DeveloperTools";
import { can } from "@/lib/company-permissions";
import { listWebhooks, WEBHOOK_EVENTS } from "@/lib/webhooks";
import type { AdminCtx } from "./context";

// Webhooks (eier og administratorer). Uten Bedrift sendes ingenting, og persondata bare når
// det er slått på for hver webhook (lib/webhooks.ts).
export default async function UtviklereTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, monthly, canBuy, t } = ctx;
  const hooks = await listWebhooks(user.id, company.id);

  if (!business && hooks.length === 0) return <Upsell companyId={company.id} price={monthly} canBuy={canBuy} t={t} />;
  const active = hooks.filter((h) => h.active).length;
  const personal = hooks.filter((h) => h.active && h.includePersonalData).length;

  return (
    <section className="space-y-4">
      <p className="max-w-2xl text-sm text-mist">
        {t("Vi sender en POST med JSON til adressen når noe skjer med stillingene deres, signert med")}{" "}
        <code className="font-mono">Vis-Signature</code>. {t("Se")}{" "}
        <Link href="/utviklere#webhooks" className="text-ice hover:underline">
          {t("dokumentasjonen")}
        </Link>
        .
      </p>
      {hooks.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-fill px-2.5 py-1 font-medium text-mist">{t("{n} av {total} aktive", { n: active, total: hooks.length })}</span>
          <span className={`rounded-full px-2.5 py-1 font-medium ${personal ? "tone tone-warn" : "tone tone-success"}`}>
            {personal ? t("{n} sender persondata", { n: personal }) : t("Ingen sender persondata")}
          </span>
        </div>
      )}
      {!business && (
        <p className="flex max-w-2xl items-start gap-2 rounded-[14px] bg-warn/10 p-3.5 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("Bedrift-abonnementet er ikke aktivt, så ingenting sendes til webhookene. De starter igjen når abonnementet er aktivt.")}
        </p>
      )}
      <Webhooks companyId={company.id} hooks={hooks} events={WEBHOOK_EVENTS} canManage={can(role, "webhooks.manage") && business} />
      <p className="flex items-center gap-2 text-xs text-mist">
        <ShieldCheck className="size-3.5 shrink-0 text-success" /> {t("Webhooks slås av når den som la dem til, forlater bedriften. Alle endringer logges.")}
      </p>
    </section>
  );
}
