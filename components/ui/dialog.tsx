"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/components/LocaleProvider";

// Modal basert på <dialog>: nettleseren tar seg av fokus, Esc og at resten av siden
// ikke kan klikkes. Klikk utenfor lukker.
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className={`glass-strong max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto overscroll-contain ${width} rounded-[30px] p-6 sm:max-h-[calc(100dvh-3rem)] sm:p-7`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">{title}</h2>
              {description && <p className="mt-1.5 text-sm leading-6 text-mist">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Lukk")}
              className="-mr-2 -mt-1 flex size-8 items-center justify-center rounded-full bg-fill text-mist transition hover:bg-fill-2 hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </dialog>
  );
}
