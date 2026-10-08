import CompanyForm from "@/components/company/CompanyForm";
import { can } from "@/lib/company-permissions";
import type { AdminCtx } from "./context";

export default async function ProfilTab({ ctx }: { ctx: AdminCtx }) {
  const { company, role, t } = ctx;
  if (!can(role, "company.edit")) return <p className="text-mist">{t("Bare eier og administratorer kan endre bedriftsprofilen.")}</p>;
  return (
    <CompanyForm
      companyId={company.id}
      logoUrl={company.logoUrl}
      canDelete={can(role, "company.delete")}
      initial={{ name: company.name, website: company.website ?? "", location: company.location ?? "", size: company.size ?? "", about: company.about ?? "" }}
    />
  );
}
