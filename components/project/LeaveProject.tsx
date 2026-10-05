"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { leaveProjectAction } from "@/app/actions/projects";
import { useT } from "@/components/LocaleProvider";
import Dialog from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// Et medlem som ikke vil stå oppført på prosjektet, kan fjerne seg selv.
export default function LeaveProject({ projectId, owner }: { projectId: string; owner: string }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const leave = () =>
    startTransition(async () => {
      const result = await leaveProjectAction(projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("Du er fjernet fra prosjektet"));
      router.refresh();
    });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="w-full text-mist hover:text-danger">
        <LogOut className="size-4" /> {t("Fjern meg fra prosjektet")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Fjerne deg fra prosjektet?")}
        description={t("Du vises ikke lenger som medlem. {name} kan legge deg til igjen.", { name: owner })}
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("Avbryt")}
          </Button>
          <Button variant="danger" loading={pending} onClick={leave}>
            {t("Fjern meg")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
