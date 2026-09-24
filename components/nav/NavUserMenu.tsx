"use client";

import { useRouter } from "next/navigation";
import { BarChart3, FileText, LogOut, Moon, Settings, Shield, Sparkles, Sun, UserRound, UserPen } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { authClient } from "@/lib/auth-client";

export type NavUser = { username: string; name: string; image: string | null; unread?: number; isAdmin?: boolean } | null;

const THEMES: { name: Theme; label: string; Icon: typeof Moon }[] = [
  { name: "midnight", label: "Midnatt", Icon: Sparkles },
  { name: "dark", label: "Mørk", Icon: Moon },
  { name: "light", label: "Lys", Icon: Sun },
];

export function ThemeButtons({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Fargetema" className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink-2/50 p-1">
      {THEMES.map(({ name, label, Icon }) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={theme === name}
          onClick={() => setTheme(name)}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            theme === name ? "bg-primary text-on-primary" : "text-mist hover:bg-surface-2 hover:text-fg"
          }`}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}

// Profilmenyen: lenker til profil, innsikt og innstillinger, tema og utlogging.
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
  return (
    <Menu label="Profilmeny" side={side} align={align} trigger={trigger} className="w-64">
      <div className="flex items-center gap-3 px-3 pb-3 pt-2">
        <Avatar name={user.name} image={user.image} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
          <p className="truncate text-xs text-mist">@{user.username}</p>
        </div>
      </div>
      <MenuSeparator />
      <MenuItem href={`/@${user.username}`} icon={<UserRound className="size-4" />}>
        Profilen din
      </MenuItem>
      <MenuItem href="/innsikt" icon={<BarChart3 className="size-4" />}>
        Innsikt
      </MenuItem>
      <MenuItem href="/profil/rediger" icon={<UserPen className="size-4" />}>
        Rediger profil
      </MenuItem>
      <MenuItem href="/profil/rediger/cv" icon={<FileText className="size-4" />}>
        CV
      </MenuItem>
      <MenuItem href="/profil/rediger/konto" icon={<Settings className="size-4" />}>
        Konto og varsler
      </MenuItem>
      {user.isAdmin && (
        <MenuItem href="/admin" icon={<Shield className="size-4" />}>
          Moderering
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuLabel>Tema</MenuLabel>
      <div className="px-2 pb-2">
        <ThemeButtons />
      </div>
      <MenuSeparator />
      <MenuItem
        icon={<LogOut className="size-4" />}
        onSelect={async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        }}
      >
        Logg ut
      </MenuItem>
    </Menu>
  );
}
