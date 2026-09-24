"use client";

import { useState } from "react";
import { Flag, MoreHorizontal, Shield } from "lucide-react";
import ReportDialog from "@/components/moderation/ReportDialog";
import { buttonClass } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";

// «Mer»-menyen på et prosjekt: rapporter (og moderering for admin).
export default function ProjectMenu({ projectId, loggedIn, isAdmin }: { projectId: string; loggedIn: boolean; isAdmin: boolean }) {
  const [reporting, setReporting] = useState(false);
  return (
    <>
      <Menu
        label="Mer"
        align="end"
        trigger={({ open, toggle, id }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            aria-label="Flere valg"
            className={buttonClass({ variant: "secondary", size: "icon" })}
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      >
        <MenuItem icon={<Flag className="size-4" />} onSelect={() => setReporting(true)} danger>
          Rapporter prosjektet
        </MenuItem>
        {isAdmin && (
          <MenuItem href={`/admin?prosjekt=${projectId}`} icon={<Shield className="size-4" />}>
            Moderer
          </MenuItem>
        )}
      </Menu>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="project" targetId={projectId} loggedIn={loggedIn} />
    </>
  );
}
