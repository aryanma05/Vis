"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useTransition, type ReactNode } from "react";
import { ArrowLeftRight, Check, Crown, Ellipsis, KeyRound, LogOut, Minus, RefreshCw, Undo2, UserMinus } from "lucide-react";
import { changeMemberRoleAction, leaveCompanyAction, removeCompanyMemberAction, setCompanySecurityAction, setShowOnPageAction } from "@/app/actions/companies";
import { resendInviteAction, revokeInviteAction, transferOwnershipAction } from "@/app/actions/company-invites";
import { useRun, type Result } from "@/components/company/useRun";
import { useT } from "@/components/LocaleProvider";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import Switch from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ROLE_ACCESS, ROLE_LABEL } from "@/lib/company-labels";
import { assignableRoles, canManageMember, type CompanyRole } from "@/lib/company-permissions";

// Verktøyene i «Team og tilgang»: menyen per medlem, invitasjoner som venter og «Krev tofaktor».
// Alt sjekkes på nytt på serveren; her skjules bare det rollen ikke kan.

const EASE = [0.16, 1, 0.3, 1] as const;

// «Dette får du tilgang til»: Check for det rollen kan, strek for det den ikke kan. Punktene
// glir inn på nytt når man bytter rolle.
export function RoleAccessList({ role, className = "" }: { role: CompanyRole; className?: string }) {
  const t = useT();
  const reduce = useReduceMotion();
  return (
    <ul key={role} className={`space-y-1.5 text-sm ${className}`}>
      {ROLE_ACCESS[role].map((item, i) => (
        <motion.li
          key={item.label}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE, delay: i * 0.04 }}
          className={`flex items-start gap-2 ${item.ok ? "text-fg" : "text-mist"}`}
        >
          {item.ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <Minus className="mt-0.5 size-4 shrink-0 text-mist" aria-hidden="true" />}
          <span>
            <span className="sr-only">{item.ok ? t("Kan:") : t("Kan ikke:")} </span>
            {t(item.label)}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

// Bekreftelse før noe som ikke kan angres (Dialog sm, rød knapp).
function Confirm({
  open,
  onClose,
  title,
  description,
  action,
  pending,
  onConfirm,
  danger = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  action: ReactNode;
  pending: boolean;
  onConfirm: () => void;
  danger?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm">
      {children}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          {t("Avbryt")}
        </Button>
        <Button variant={danger ? "danger" : "primary"} loading={pending} onClick={onConfirm}>
          {action}
        </Button>
      </div>
    </Dialog>
  );
}

// Kjører en handling fra en dialog og lukker den når den lykkes.
function useDialogAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>, success: string, after?: () => void) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? "Noe gikk galt.");
      setOpen(null);
      toast.success(success);
      if (after) after();
      else router.refresh();
    });
  return { pending, open, setOpen, run, router };
}

export type MenuMember = { userId: string; name: string; role: CompanyRole };

// Menyen på hvert medlem: endre rolle, fjerne og overføre eierskap, og for deg selv: forlate bedriften.
export function MemberMenu({
  companyId,
  companySlug,
  member,
  viewerRole,
  self,
}: {
  companyId: string;
  companySlug: string;
  member: MenuMember;
  viewerRole: CompanyRole;
  self: boolean;
}) {
  const t = useT();
  const { pending, open, setOpen, run, router } = useDialogAction();
  const assignable = assignableRoles(viewerRole);
  const manage = !self && canManageMember(viewerRole, member.role, false);
  const canChangeRole = manage && assignable.length > 0;
  const canTransfer = !self && viewerRole === "owner" && member.role !== "owner";
  const canLeave = self && member.role !== "owner";
  const [role, setRole] = useState<CompanyRole>(assignable.includes(member.role) ? member.role : (assignable[0] ?? member.role));
  const first = member.name.split(/\s+/)[0] || member.name;
  if (!manage && !canTransfer && !canLeave) return null;

  return (
    <>
      <Menu
        label={t("Valg for {name}", { name: member.name })}
        trigger={({ open: isOpen, toggle, id }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={isOpen ? id : undefined}
            aria-label={t("Valg for {name}", { name: member.name })}
            className="flex size-8 items-center justify-center rounded-full text-mist transition hover:bg-fill hover:text-fg"
          >
            <Ellipsis className="size-4" />
          </button>
        )}
      >
        {canChangeRole && (
          <MenuItem icon={<KeyRound className="size-4" />} onSelect={() => setOpen("role")}>
            {t("Endre rolle")}
          </MenuItem>
        )}
        {canTransfer && (
          <MenuItem icon={<ArrowLeftRight className="size-4" />} onSelect={() => setOpen("transfer")}>
            {t("Overfør eierskap")}
          </MenuItem>
        )}
        {(canChangeRole || canTransfer) && (manage || canLeave) && <MenuSeparator />}
        {manage && (
          <MenuItem danger icon={<UserMinus className="size-4" />} onSelect={() => setOpen("remove")}>
            {t("Fjern tilgang")}
          </MenuItem>
        )}
        {canLeave && (
          <MenuItem danger icon={<LogOut className="size-4" />} onSelect={() => setOpen("leave")}>
            {t("Forlat bedriften")}
          </MenuItem>
        )}
      </Menu>

      {canChangeRole && (
        <Dialog
          open={open === "role"}
          onClose={() => setOpen(null)}
          title={t("Endre rollen til {name}", { name: first })}
          description={t("{name} får beskjed, og endringen logges.", { name: first })}
          size="sm"
        >
          <Segmented label={t("Rolle")} value={role} onChange={setRole} options={assignable.map((r) => ({ value: r, label: t(ROLE_LABEL[r]) }))} size="sm" />
          <div className="mt-4 rounded-[18px] bg-fill p-4">
            <p className="caption mb-2.5">{t("Dette får {role} tilgang til", { role: t(ROLE_LABEL[role]).toLowerCase() })}</p>
            <RoleAccessList role={role} />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(null)}>
              {t("Avbryt")}
            </Button>
            <Button loading={pending} disabled={role === member.role} onClick={() => run(() => changeMemberRoleAction(companyId, member.userId, role), "Rollen er endret")}>
              {t("Lagre rolle")}
            </Button>
          </div>
        </Dialog>
      )}

      {canTransfer && (
        <Confirm
          open={open === "transfer"}
          onClose={() => setOpen(null)}
          danger={false}
          title={t("Overføre eierskapet til {name}?", { name: first })}
          description={t("{name} får en invitasjon som må godtas innen 7 dager. Når den er godtatt, blir du administrator.", { name: first })}
          action={
            <>
              <Crown className="size-4" /> {t("Send forespørsel")}
            </>
          }
          pending={pending}
          onConfirm={() => run(() => transferOwnershipAction(companyId, member.userId), "Forespørselen er sendt")}
        >
          <ul className="mb-6 space-y-1.5 text-sm text-mist">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> {t("Eieren styrer abonnementet, administratorer og sletting.")}
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> {t("Du kan trekke forespørselen tilbake så lenge den venter.")}
            </li>
          </ul>
        </Confirm>
      )}

      {manage && (
        <Confirm
          open={open === "remove"}
          onClose={() => setOpen(null)}
          title={t("Fjerne tilgangen til {name}?", { name: first })}
          description={t("{name} mister tilgangen til stillinger, søkere og lister med en gang, og får beskjed på e-post. Webhooks personen har laget, slås av.", { name: first })}
          action={t("Fjern tilgang")}
          pending={pending}
          onConfirm={() => run(() => removeCompanyMemberAction(companyId, member.userId), "Tilgangen er fjernet")}
        />
      )}

      {canLeave && (
        <Confirm
          open={open === "leave"}
          onClose={() => setOpen(null)}
          title={t("Forlate bedriften?")}
          description={t("Du mister tilgangen til administrasjonen med en gang. For å komme tilbake må noen invitere deg på nytt.")}
          action={t("Forlat bedriften")}
          pending={pending}
          onConfirm={() =>
            run(
              () => leaveCompanyAction(companyId),
              "Du har forlatt bedriften",
              () => {
                router.push(`/bedrift/${companySlug}`);
                router.refresh();
              },
            )
          }
        />
      )}
    </>
  );
}

// «Send på nytt» og «Trekk tilbake» på en invitasjon som venter (eller nylig har utløpt).
export function InviteActions({ inviteId, label, expired }: { inviteId: string; label: string; expired: boolean }) {
  const t = useT();
  const { pending, run } = useRun();
  const dialog = useDialogAction();
  return (
    <div className="flex items-center gap-1">
      <Button
        size="xs"
        variant="secondary"
        loading={pending}
        onClick={() => run(() => resendInviteAction(inviteId), t("Invitasjonen er sendt på nytt"))}
        aria-label={t("Send invitasjonen til {name} på nytt", { name: label })}
      >
        <RefreshCw className="size-3.5" /> {expired ? t("Send ny") : t("Send på nytt")}
      </Button>
      <Button size="xs" variant="ghost" className="hover:text-danger" onClick={() => dialog.setOpen("revoke")} aria-label={t("Trekk tilbake invitasjonen til {name}", { name: label })}>
        <Undo2 className="size-3.5" />
        <span className="hidden sm:inline">{t("Trekk tilbake")}</span>
      </Button>
      <Confirm
        open={dialog.open === "revoke"}
        onClose={() => dialog.setOpen(null)}
        title={t("Trekke tilbake invitasjonen?")}
        description={t("Lenken til {name} slutter å virke med en gang. Dere kan invitere på nytt senere.", { name: label })}
        action={t("Trekk tilbake")}
        pending={dialog.pending}
        onConfirm={() => dialog.run(() => revokeInviteAction(inviteId), "Invitasjonen er trukket tilbake")}
      />
    </div>
  );
}

// «Krev tofaktor» (Bedrift, bare eieren). Eieren må selv ha tofaktor for å slå det på.
export function RequireTwoFactor({
  companyId,
  enabled,
  business,
  ownerHas2fa,
  abonnementHref,
}: {
  companyId: string;
  enabled: boolean;
  business: boolean;
  ownerHas2fa: boolean;
  abonnementHref: string;
}) {
  const t = useT();
  const { pending, run } = useRun();
  const [on, setOn] = useState(enabled);
  const locked = !enabled && (!business || !ownerHas2fa);
  return (
    <div>
      <Switch
        checked={on}
        disabled={pending || locked}
        label={t("Krev tofaktor")}
        description={t("Alle i bedriften må ha to-trinns innlogging for å se søkere, stillinger og lister.")}
        onChange={(next) => {
          setOn(next);
          run(async () => {
            const result = await setCompanySecurityAction(companyId, next);
            if (!result.ok) setOn(!next);
            return result;
          }, next ? t("Tofaktor kreves nå for alle") : t("Tofaktor kreves ikke lenger"));
        }}
      />
      {!business && !enabled && (
        <p className="mt-3 text-[13px] text-mist">
          {t("Krever Bedrift.")}{" "}
          <Link href={abonnementHref} className="font-medium text-ice hover:underline">
            {t("Se abonnementet")}
          </Link>
        </p>
      )}
      {business && !ownerHas2fa && !enabled && (
        <p className="mt-3 text-[13px] text-mist">
          {t("Slå på tofaktor for din egen konto først, så du ikke stenger deg selv ute.")}{" "}
          <Link href="/profil/rediger/konto#to-trinn" className="font-medium text-ice hover:underline">
            {t("Slå på")}
          </Link>
        </p>
      )}
    </div>
  );
}

// «Vis meg på bedriftssiden»: bare personen selv bestemmer, og det er av til man slår det på.
export function ShowOnPageSwitch({ companyId, enabled }: { companyId: string; enabled: boolean }) {
  const t = useT();
  const { pending, run } = useRun();
  const [on, setOn] = useState(enabled);
  return (
    <Switch
      checked={on}
      disabled={pending}
      label={t("Vis meg på bedriftssiden")}
      description={t("Profilen og prosjektene dine vises i teamet. Ingen andre kan slå det på for deg.")}
      onChange={(next) => {
        setOn(next);
        run(async () => {
          const result = await setShowOnPageAction(companyId, next);
          if (!result.ok) setOn(!next);
          return result;
        }, next ? t("Du vises nå på bedriftssiden") : t("Du vises ikke lenger på bedriftssiden"));
      }}
    />
  );
}
