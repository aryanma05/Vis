"use client";

import { useState } from "react";
import { openPortalAction, startCheckoutAction } from "@/app/actions/billing";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// Sender brukeren til Stripe (betaling eller kundeportalen).
export default function CheckoutButton({
  plan,
  interval = "month",
  companyId,
  portal = false,
  children,
  variant = "primary",
  className,
}: {
  plan?: "pro" | "business";
  interval?: "month" | "year";
  companyId?: string;
  portal?: boolean;
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    const result = portal ? await openPortalAction(companyId) : await startCheckoutAction(plan ?? "pro", interval, companyId);
    if (!result.ok || !result.data) {
      setPending(false);
      if (result.ok) toast.error("Noe gikk galt. Prøv igjen.");
      else toast.error(result.error);
      return;
    }
    window.location.href = result.data;
  }

  return (
    <Button onClick={go} loading={pending} variant={variant} className={className}>
      {children}
    </Button>
  );
}
