"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ui } from "@/components/ui";

// Passordfelt med knapp for å vise passordet, så man ser skrivefeil på mobil.
export default function PasswordInput({
  invalid,
  inputRef,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; inputRef?: React.Ref<HTMLInputElement> }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        ref={inputRef}
        type={visible ? "text" : "password"}
        aria-invalid={invalid}
        className={`${ui.input} pr-12 ${invalid ? "border-red-500/60" : ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Skjul passord" : "Vis passord"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-mist transition hover:text-fg"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
