"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// Del en lenke: telefonens deleark der det finnes, ellers kopier til utklippstavlen.
export default function ShareButton({
  path,
  title,
  text,
  label = "Del",
  variant = "secondary",
  size = "sm",
  iconOnly = false,
}: {
  path: string;
  title: string;
  text?: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    const canShare = typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (canShare) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lenken er kopiert", { description: url.replace(/^https?:\/\//, "") });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Klarte ikke å kopiere lenken.");
    }
  }

  const Icon = copied ? Check : iconOnly ? Link2 : Share2;
  return (
    <button
      type="button"
      onClick={share}
      aria-label={iconOnly ? label : undefined}
      className={buttonClass({ variant, size: iconOnly ? (size === "sm" ? "icon-sm" : "icon") : size })}
    >
      <Icon className="size-4" aria-hidden="true" />
      {!iconOnly && (copied ? "Kopiert" : label)}
    </button>
  );
}
