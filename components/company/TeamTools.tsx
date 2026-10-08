"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { removeEmployeeAction } from "@/app/actions/companies";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

// Folk kommer inn i teamet på bedriftssiden bare med en godtatt invitasjon (InviteDialog).

// Fjern en person fra teamet (administrasjonen), eller deg selv (bedriftssiden).
export function RemoveEmployee({ companyId, userId, name, self = false }: { companyId: string; userId?: string; name?: string; self?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      const result = await removeEmployeeAction(companyId, userId);
      if (!result.ok) return void toast.error(result.error);
      setOpen(false);
      if (self) toast.success("Du er fjernet fra teamet");
      else toast.success("Fjernet fra teamet");
      router.refresh();
    });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-mist transition hover:text-danger">
        <UserMinus className="size-4" /> {self ? t("Fjern meg fra teamet") : t("Fjern")}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={self ? t("Fjerne deg fra teamet på bedriftssiden?") : t("Fjerne {name} fra teamet?", { name: name ?? t("personen") })}
        description={
          self
            ? t("Profilen og prosjektene dine vises ikke lenger på bedriftssiden. Bedriften kan invitere deg igjen.")
            : t("Personen vises ikke lenger på bedriftssiden. Dere kan invitere på nytt senere.")
        }
      >
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("Avbryt")}
          </Button>
          <Button variant="danger" loading={pending} onClick={remove}>
            {self ? t("Fjern meg") : t("Fjern")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
