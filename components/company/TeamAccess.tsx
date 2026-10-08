"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { addCompanyMemberAction, removeCompanyMemberAction } from "@/app/actions/companies";
import { useRun } from "@/components/company/useRun";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { ROLE_LABEL } from "@/lib/company-labels";

export function AddMember({ companyId }: { companyId: string }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const { pending, run, t } = useRun();
  return (
    <form
      className="flex max-w-xl flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!username.trim()) return;
        run(() => addCompanyMemberAction(companyId, username, role), t("Lagt til"));
        setUsername("");
      }}
    >
      <input className={`${inputClass} min-w-48 flex-1`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("@brukernavn")} aria-label={t("Brukernavn")} autoCapitalize="none" />
      <select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} className={`${inputClass} w-auto`} aria-label={t("Rolle")}>
        <option value="member">{t(ROLE_LABEL.member)}</option>
        <option value="admin">{t(ROLE_LABEL.admin)}</option>
      </select>
      <Button type="submit" size="sm" loading={pending} disabled={!username.trim()}>
        {t("Legg til")}
      </Button>
    </form>
  );
}

export function RemoveMember({ companyId, userId }: { companyId: string; userId: string }) {
  const { pending, run, t } = useRun();
  return (
    <Button
      size="xs"
      variant="ghost"
      className="hover:text-danger"
      loading={pending}
      onClick={() => run(() => removeCompanyMemberAction(companyId, userId), t("Fjernet"))}
      aria-label={t("Fjern")}
    >
      <UserMinus className="size-3.5" />
    </Button>
  );
}
