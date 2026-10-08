import type { company } from "@/db/schema";
import type { CompanyRole } from "@/lib/company-permissions";
import type { AdminBadges } from "@/lib/company-stats";
import type { T } from "@/lib/i18n";

// Toppen av administrasjonen på alle faner. P4 fyller inn: logo, navn, bekreftet-merke,
// rolle, plan, «Ny stilling», «Se bedriftssiden» og en linje med det som har skjedd.
export default function AdminHero({
  business,
  t,
}: {
  company: typeof company.$inferSelect;
  role: CompanyRole;
  business: boolean;
  base: string;
  badges: AdminBadges;
  t: T;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-4xl font-bold tracking-tight">{t("Administrer")}</h1>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${business ? "bg-success/15 text-success" : "bg-fill text-mist"}`}>
        {business ? t("Bedrift") : t("Gratis")}
      </span>
    </div>
  );
}
