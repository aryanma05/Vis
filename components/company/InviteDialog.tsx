"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Clock, KeyRound, Mail, UserPlus } from "lucide-react";
import { inviteAction } from "@/app/actions/company-invites";
import { RoleAccessList } from "@/components/company/TeamAccess";
import { useT } from "@/components/LocaleProvider";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Hint, inputClass, labelClass } from "@/components/ui/field";
import OptionalLabel from "@/components/ui/optional-label";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ROLE_LABEL } from "@/lib/company-labels";
import type { CompanyRole } from "@/lib/company-permissions";

type Mode = "member" | "employee";
export type Seats = { used: number; pending: number; max: number };

// Samme regel som lib/company-invites.ts: @ med et punktum etter er en e-postadresse.
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// «Inviter»: én knapp og én dialog for både tilgang (rolle) og teamet på bedriftssiden.
// Ingen får tilgang eller vises før de har sagt ja, og invitasjonen gjelder i 7 dager.
export default function InviteDialog({
  companyId,
  assignable,
  seats,
  teamSeats,
  mode: initialMode = "member",
  label,
  variant = "primary",
  size = "sm",
}: {
  companyId: string;
  // Rollene du kan gi (assignableRoles). Tom: bare teamet.
  assignable: CompanyRole[];
  seats: Seats;
  teamSeats: Seats;
  mode?: Mode;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(assignable.length > 0 ? initialMode : "employee");
  const [target, setTarget] = useState("");
  const [role, setRole] = useState<CompanyRole>(assignable.includes("member") ? "member" : (assignable[0] ?? "member"));
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const current = mode === "member" ? seats : teamSeats;
  const taken = current.used + current.pending;
  const full = taken >= current.max;
  const email = looksLikeEmail(target);

  const reset = () => {
    setTarget("");
    setTitle("");
    setError(null);
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const result = await inviteAction(companyId, { target, kind: mode, role, title });
      if (!result.ok) return void setError(result.error ?? t("Noe gikk galt."));
      setOpen(false);
      reset();
      toast.success("Invitasjonen er sendt", { description: "Den gjelder i 7 dager. Du ser den under «Venter på svar»." });
      router.refresh();
    });

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> {label ?? t("Inviter")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Inviter til bedriften")}
        description={t("Personen får en invitasjon og bestemmer selv. Ingen får tilgang eller vises før de har sagt ja.")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (target.trim() && !full) submit();
          }}
          className="space-y-5"
        >
          {assignable.length > 0 && (
            <Segmented
              label={t("Hva slags invitasjon")}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                {
                  value: "member",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <KeyRound className="size-3.5" /> {t("Gi tilgang")}
                    </span>
                  ),
                },
                {
                  value: "employee",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="size-3.5" /> {t("Legg til i teamet")}
                    </span>
                  ),
                },
              ]}
            />
          )}

          <div>
            <label htmlFor="invite-target" className={labelClass}>
              {t("@brukernavn eller e-post")}
            </label>
            <div className="relative">
              <input
                id="invite-target"
                className={`${inputClass} pr-10`}
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setError(null);
                }}
                placeholder={t("@kari eller kari@bedrift.no")}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                maxLength={254}
                aria-invalid={Boolean(error)}
                aria-describedby="invite-hint"
                required
              />
              {email && <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />}
            </div>
            {error ? (
              <p role="alert" className="mt-1.5 text-[13px] leading-5 text-danger">
                {error}
              </p>
            ) : (
              <Hint className="mt-1.5">
                <span id="invite-hint">
                  {email
                    ? t("Vi sender en personlig lenke. Den kan bare brukes av noen som er logget inn med akkurat denne adressen.")
                    : t("Personen får et varsel på Vis, og e-post hvis adressen er bekreftet.")}
                </span>
              </Hint>
            )}
          </div>

          {mode === "member" ? (
            <div>
              <p className={labelClass}>{t("Rolle")}</p>
              <Segmented label={t("Rolle")} value={role} onChange={setRole} options={assignable.map((r) => ({ value: r, label: t(ROLE_LABEL[r]) }))} size="sm" />
              <div className="mt-3 rounded-[18px] bg-fill p-4">
                <p className="caption mb-2.5">{t("Dette får {role} tilgang til", { role: t(ROLE_LABEL[role]).toLowerCase() })}</p>
                <RoleAccessList role={role} />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="invite-title" className={labelClass}>
                {t("Tittel")}
                <OptionalLabel />
              </label>
              <input id="invite-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("f.eks. Frontend-utvikler")} maxLength={80} />
              <Hint>{t("Vises med profilen og prosjektene deres på bedriftssiden. Gir ingen tilgang til administrasjonen.")}</Hint>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-[13px] text-mist">
              <span>{mode === "member" ? t("Plasser med tilgang") : t("Plasser i teamet")}</span>
              <span className={`tabular-nums ${full ? "font-medium text-warn" : ""}`}>{t("{n} av {max}", { n: taken, max: current.max })}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden="true">
              <div className={`h-full rounded-full transition-all ${full ? "bg-warn" : "bg-sea"}`} style={{ width: `${Math.min(100, (taken / Math.max(1, current.max)) * 100)}%` }} />
            </div>
            {full && <p className="mt-2 text-[13px] text-warn">{t("Alle plassene er brukt. Fjern noen eller trekk tilbake en invitasjon først.")}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-mist">
              <Clock className="size-3.5" /> {t("Gjelder i 7 dager")}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("Avbryt")}
              </Button>
              <Button type="submit" loading={pending} disabled={!target.trim() || full}>
                {t("Send invitasjon")}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
