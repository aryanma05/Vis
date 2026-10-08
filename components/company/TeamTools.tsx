"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { addEmployeeAction, removeEmployeeAction } from "@/app/actions/companies";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

// Legg til folk i teamet på bedriftssiden (uten tilgang til å administrere).
export function AddEmployee({ companyId }: { companyId: string }) {
  const t = useT();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await addEmployeeAction(companyId, username, title);
          if (!result.ok) return void toast.error(result.error);
          toast.success(t("Lagt til i teamet"), { description: t("Personen får beskjed og kan fjerne seg selv.") });
          setUsername("");
          setTitle("");
          router.refresh();
        });
      }}
      className="flex flex-wrap gap-2"
    >
      <input className={`${inputClass} h-10 min-w-40 flex-1`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("Brukernavn på Vis")} aria-label={t("Brukernavn")} required />
      <input className={`${inputClass} h-10 min-w-40 flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Rolle, f.eks. Frontend-utvikler")} aria-label={t("Rolle")} maxLength={80} />
      <Button type="submit" size="sm" loading={pending} className="h-10">
        {t("Legg til")}
      </Button>
    </form>
  );
}

// Fjern en person fra teamet (administrasjonen), eller deg selv (bedriftssiden).
export function RemoveEmployee({ companyId, userId, self = false }: { companyId: string; userId?: string; self?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        window.confirm(self ? t("Fjerne deg fra teamet på bedriftssiden?") : t("Fjerne personen fra teamet?")) &&
        start(async () => {
          const result = await removeEmployeeAction(companyId, userId);
          if (!result.ok) return void toast.error(result.error);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-danger"
    >
      <UserMinus className="size-4" /> {self ? t("Fjern meg fra teamet") : t("Fjern")}
    </button>
  );
}
