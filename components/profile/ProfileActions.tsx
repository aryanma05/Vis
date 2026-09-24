"use client";

import { useState } from "react";
import { BarChart3, FileText, Flag, MoreHorizontal, PenLine } from "lucide-react";
import ReportDialog from "@/components/moderation/ReportDialog";
import FollowButton from "@/components/social/FollowButton";
import ShareButton from "@/components/social/ShareButton";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";

// Knappene på visittkortet: følg/rediger, del og en meny med mer.
export default function ProfileActions({
  userId,
  username,
  name,
  isOwner,
  isFollowing,
  loggedIn,
}: {
  userId: string;
  username: string;
  name: string;
  isOwner: boolean;
  isFollowing: boolean;
  loggedIn: boolean;
}) {
  const [reporting, setReporting] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOwner ? (
        <ButtonLink href="/profil/rediger" size="sm" className="flex-1 sm:flex-none">
          <PenLine className="size-4" /> Rediger profil
        </ButtonLink>
      ) : (
        <FollowButton userId={userId} initialFollowing={isFollowing} loggedIn={loggedIn} name={name} className="flex-1 sm:flex-none" />
      )}
      <ShareButton path={`/@${username}`} title={`${name} på Vis`} label="Del profil" />
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
            className={buttonClass({ variant: "secondary", size: "icon-sm" })}
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      >
        <MenuItem href={`/@${username}/cv`} icon={<FileText className="size-4" />}>
          Åpne CV-en
        </MenuItem>
        {isOwner ? (
          <>
            <MenuItem href="/innsikt" icon={<BarChart3 className="size-4" />}>
              Innsikt
            </MenuItem>
            <MenuItem href="/profil/rediger/cv" icon={<PenLine className="size-4" />}>
              Rediger CV
            </MenuItem>
          </>
        ) : (
          <>
            <MenuSeparator />
            <MenuItem icon={<Flag className="size-4" />} onSelect={() => setReporting(true)} danger>
              Rapporter profilen
            </MenuItem>
          </>
        )}
      </Menu>
      {!isOwner && (
        <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="user" targetId={userId} loggedIn={loggedIn} />
      )}
    </div>
  );
}
