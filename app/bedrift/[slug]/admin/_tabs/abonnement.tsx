import CheckoutButton from "@/app/priser/CheckoutButton";
import { formatDate } from "@/lib/format";
import type { AdminCtx } from "./context";

export default async function AbonnementTab({ ctx }: { ctx: AdminCtx }) {
  const { company, plan, business, monthly, canBuy, t, locale, query } = ctx;
  return (
    <section className="max-w-xl rounded-[22px] glass-card p-6">
      {query.avbrutt && <p className="mb-4 text-sm text-mist">{t("Betalingen ble avbrutt. Ingenting er trukket.")}</p>}
      <p className="text-lg font-semibold">{business ? t("Bedrift") : t("Gratis")}</p>
      {plan.source === "stripe" && plan.renewsAt && (
        <p className="mt-1 text-sm text-mist">
          {plan.cancelAtPeriodEnd
            ? t("Avsluttes {date}.", { date: formatDate(plan.renewsAt, locale) })
            : t("Fornyes {date}", { date: formatDate(plan.renewsAt, locale) })}
        </p>
      )}
      {plan.source === "grant" && (
        <p className="mt-1 text-sm text-mist">
          {plan.grantUntil ? t("Gitt av Vis til {date}.", { date: formatDate(plan.grantUntil, locale) }) : t("Gitt av Vis.")}
        </p>
      )}
      {!business && (
        <p className="mt-2 text-sm text-mist">
          {t("{price} i måneden: ubegrenset med stillinger, kandidatsøk, lister med eksport og direkte kontakt.", { price: monthly })}
        </p>
      )}
      {canBuy ? (
        <div className="mt-5">
          {plan.source === "stripe" ? (
            <CheckoutButton portal companyId={company.id} variant="secondary">
              {t("Administrer betaling og fakturaer")}
            </CheckoutButton>
          ) : !business ? (
            <CheckoutButton plan="business" companyId={company.id}>
              {t("Start Bedrift")}
            </CheckoutButton>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-mist">{t("Bare eier og administratorer kan endre abonnementet.")}</p>
      )}
    </section>
  );
}
