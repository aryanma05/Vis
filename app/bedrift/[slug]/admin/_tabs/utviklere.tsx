import Link from "next/link";
import Upsell from "@/components/company/Upsell";
import { Webhooks } from "@/components/developers/DeveloperTools";
import { can } from "@/lib/company-permissions";
import { listWebhooks, WEBHOOK_EVENTS } from "@/lib/webhooks";
import type { AdminCtx } from "./context";

export default async function UtviklereTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, monthly, canBuy, t } = ctx;
  const hooks = await listWebhooks(user.id, company.id);

  if (!business && hooks.length === 0) return <Upsell companyId={company.id} price={monthly} canBuy={canBuy} t={t} />;

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
      <Webhooks companyId={company.id} hooks={hooks} events={WEBHOOK_EVENTS} canManage={can(role, "webhooks.manage") && business} />
    </section>
  );
}
