import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import type { AdminCtx } from "./context";

// P2 fyller inn: databehandleravtale, lagringstid, aktivitetslogg med CSV og underleverandører.
export default async function PersonvernTab({ ctx }: { ctx: AdminCtx }) {
  const { t } = ctx;
  return (
    <EmptyState icon={<ShieldCheck className="size-5" />} title={t("Personvern og logg")}>
      {t("Her kommer databehandleravtalen, hvor lenge søknader lagres, og aktivitetsloggen.")}
    </EmptyState>
  );
}
