import { Lock } from "lucide-react";
import CheckoutButton from "@/app/priser/CheckoutButton";
import { UPSELL_TEXT } from "@/lib/company-labels";
import type { T } from "@/lib/i18n";

// Det Bedrift låser opp på en fane, med kjøpsknapp for dem som kan kjøpe. P4 bygger videre.
export default function Upsell({ companyId, price, canBuy, t, feature = "kandidater" }: { companyId: string; price: string; canBuy: boolean; t: T; feature?: keyof typeof UPSELL_TEXT }) {
  return (
    <div className="rounded-[22px] glass-card p-6">
      <p className="flex items-center gap-2 font-semibold">
        <Lock className="size-4 text-mist" /> {t("Krever Bedrift")}
      </p>
      <p className="mt-2 max-w-xl text-sm text-mist">
        {t(UPSELL_TEXT[feature])} {t("{price} i måneden, ingen bindingstid.", { price })}{" "}
        {t("Til sammenligning tar et rekrutteringsbyrå ofte 15–25 % av årslønna for én ansettelse.")}
      </p>
      {canBuy && (
        <div className="mt-4">
          <CheckoutButton plan="business" companyId={companyId}>
            {t("Start Bedrift")}
          </CheckoutButton>
        </div>
      )}
    </div>
  );
}
