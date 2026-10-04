"use server";

import { runAction } from "@/lib/action";
import { openPortal, startCheckout, type Interval, type PaidPlan } from "@/lib/billing";
import { getCompanyById, requireCompanyRole } from "@/lib/companies";
import { UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";

// Returnerer adressen til Stripe Checkout, som nettleseren sendes videre til.
export async function startCheckoutAction(plan: PaidPlan, interval: Interval, companyId?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (plan !== "pro" && plan !== "business") throw new UserFacingError("Ukjent plan.");
    const period: Interval = interval === "year" && plan === "pro" ? "year" : "month";
    let company = null;
    if (plan === "business") {
      const found = companyId ? await getCompanyById(String(companyId)) : null;
      if (!found) throw new UserFacingError("Velg hvilken bedrift abonnementet gjelder.");
      await requireCompanyRole(user.id, found.id, ["owner", "admin"]);
      company = { id: found.id, name: found.name, slug: found.slug };
    }
    return startCheckout({ userId: user.id, email: user.email, name: user.name, plan, interval: period, company });
  }, "billing.checkout");
}

export async function openPortalAction(companyId?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (companyId) {
      const found = await getCompanyById(String(companyId));
      if (!found) throw new UserFacingError("Fant ikke bedriften.");
      await requireCompanyRole(user.id, found.id, ["owner", "admin"]);
      return openPortal("company", found.id, `/bedrift/${found.slug}/admin?fane=abonnement`);
    }
    return openPortal("user", user.id, "/profil/rediger/konto#abonnement");
  }, "billing.portal");
}
