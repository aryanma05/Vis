import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/components/LocaleProvider";
import { toast } from "@/components/ui/toast";

export type Result = { ok: boolean; error?: string };

// Kjører en Server Action fra en knapp: viser feilen som toast, ellers en valgfri
// bekreftelse, og laster siden på nytt. Felles for verktøyene i bedriftsadministrasjonen.
export function useRun() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, success?: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? t("Noe gikk galt."));
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  return { pending, run, t };
}
