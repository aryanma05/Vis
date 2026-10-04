"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flag, MoreHorizontal, Shield, Sparkles } from "lucide-react";
import { setFeaturedAction } from "@/app/actions/admin";
import { useT } from "@/components/LocaleProvider";
import ReportDialog from "@/components/moderation/ReportDialog";
import { buttonClass } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";

// «Mer»-menyen på et prosjekt: rapporter (og moderering for admin).
export default function ProjectMenu({
  projectId,
  loggedIn,
  isAdmin,
  featured = false,
}: {
  projectId: string;
  loggedIn: boolean;
  isAdmin: boolean;
  featured?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [reporting, setReporting] = useState(false);

  async function toggleFeatured() {
    const result = await setFeaturedAction(projectId, !featured);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t(featured ? "Tatt ut av utvalgte" : "Prosjektet er valgt ut"), featured ? undefined : { description: t("Eieren får beskjed.") });
    router.refresh();
  }
  return (
    <>
      <Menu
        label={t("Mer")}
        align="end"
        trigger={({ open, toggle, id }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            aria-label={t("Flere valg")}
            className={buttonClass({ variant: "secondary", size: "icon" })}
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      >
        <MenuItem icon={<Flag className="size-4" />} onSelect={() => setReporting(true)} danger>
          {t("Rapporter prosjektet")}
        </MenuItem>
        {isAdmin && (
          <>
            <MenuItem icon={<Sparkles className="size-4" />} onSelect={toggleFeatured}>
              {t(featured ? "Ta ut av utvalgte" : "Velg ut til forsiden")}
            </MenuItem>
            <MenuItem href={`/admin?prosjekt=${projectId}`} icon={<Shield className="size-4" />}>
              {t("Moderer")}
            </MenuItem>
          </>
        )}
      </Menu>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="project" targetId={projectId} loggedIn={loggedIn} />
    </>
  );
}
