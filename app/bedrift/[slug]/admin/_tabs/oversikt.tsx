import { LayoutDashboard, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import type { AdminCtx } from "./context";

// P4 fyller inn: nøkkeltall med grafer, «Trenger oppmerksomhet», søknader per dag, trakten,
// Spart med Vis, kom i gang og aktiviteten.
export default async function OversiktTab({ ctx }: { ctx: AdminCtx }) {
  const { base, t } = ctx;
  return (
    <EmptyState
      icon={<LayoutDashboard className="size-5" />}
      title={t("Oversikt")}
      action={
        <>
          <ButtonLink href={`${base}?fane=sokere`} variant="secondary" size="sm">
            {t("Se søkerne")}
          </ButtonLink>
          <ButtonLink href={`${base}/stilling/ny`} size="sm">
            <Plus className="size-4" /> {t("Ny stilling")}
          </ButtonLink>
        </>
      }
    >
      {t("Her kommer nøkkeltall, det som trenger oppmerksomhet og siste aktivitet i bedriften.")}
    </EmptyState>
  );
}
