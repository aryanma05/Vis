"use client";

import { useRouter } from "next/navigation";
import { BarChart3, Bookmark, Building2, FileText, LogOut, Settings, Shield, Sparkles, UserCog, UserRound, UserPen } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useT } from "@/components/LocaleProvider";
import { openSettings } from "@/components/settings/settings-events";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { authClient } from "@/lib/auth-client";

export type NavUser = { username: string; name: string; image: string | null; unread?: number; isAdmin?: boolean } | null;

// Profilmenyen: lenker til profil, innsikt og konto, innstillingene og utlogging.
export default function NavUserMenu({
  user,
  side = "right",
  align = "end",
  trigger,
}: {
  user: NonNullable<NavUser>;
  side?: "right" | "top" | "bottom";
  align?: "start" | "end";
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => React.ReactNode;
}) {
  const router = useRouter();
  const t = useT();
  return (
    <Menu label={t("Profilmeny")} side={side} align={align} trigger={trigger} className="w-64">
      <div className="flex items-center gap-3 px-3 pb-3 pt-2">
        <Avatar name={user.name} image={user.image} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
          <p className="truncate text-xs text-mist">@{user.username}</p>
        </div>
      </div>
      <MenuSeparator />
      <MenuItem href={`/@${user.username}`} icon={<UserRound className="size-4" />}>
        {t("Profilen din")}
      </MenuItem>
      <MenuItem href="/innsikt" icon={<BarChart3 className="size-4" />}>
        {t("Innsikt")}
      </MenuItem>
      <MenuItem href="/samlinger" icon={<Bookmark className="size-4" />}>
        {t("Samlinger")}
      </MenuItem>
      <MenuItem href="/profil/rediger" icon={<UserPen className="size-4" />}>
        {t("Rediger profil")}
      </MenuItem>
      <MenuItem href="/profil/rediger/cv" icon={<FileText className="size-4" />}>
        CV
      </MenuItem>
      <MenuItem href="/profil/rediger/konto" icon={<UserCog className="size-4" />}>
        {t("Konto og varsler")}
      </MenuItem>
      <MenuItem href="/bedrifter" icon={<Building2 className="size-4" />}>
        {t("Bedrifter")}
      </MenuItem>
      <MenuItem href="/priser" icon={<Sparkles className="size-4" />}>
        Pro
      </MenuItem>
      {user.isAdmin && (
        <MenuItem href="/admin" icon={<Shield className="size-4" />}>
          {t("Admin")}
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={<Settings className="size-4" />} onSelect={() => openSettings()}>
        {t("Innstillinger")}
      </MenuItem>
      <MenuItem
        icon={<LogOut className="size-4" />}
        onSelect={async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        }}
      >
        {t("Logg ut")}
      </MenuItem>
    </Menu>
  );
}
