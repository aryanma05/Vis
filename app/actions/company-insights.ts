"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { getCompanyById } from "@/lib/companies";
import { setRoiSettings } from "@/lib/company-stats";
import { requireUserForAction } from "@/lib/session";

/* Spart med Vis */

// «Slik regner vi»: egne tall for timekost, årslønn, byråhonorar og annonsepris (eier og
// administrator). Bare tall går videre; resten blir standard (lib/roi.ts).
export async function setRoiSettingsAction(companyId: string, values: { hourlyCost?: unknown; salary?: unknown; agencyFee?: unknown; adPrice?: unknown } | null) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const input = {
      hourlyCost: values?.hourlyCost == null ? undefined : String(values.hourlyCost),
      salary: values?.salary == null ? undefined : String(values.salary),
      agencyFee: values?.agencyFee == null ? undefined : String(values.agencyFee),
      adPrice: values?.adPrice == null ? undefined : String(values.adPrice),
    };
    const settings = await setRoiSettings(user.id, String(companyId), input);
    const c = await getCompanyById(String(companyId));
    if (c) revalidatePath(`/bedrift/${c.slug}/admin`);
    return settings;
  }, "company.roi");
}
