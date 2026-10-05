"use client";

import { useState } from "react";
import { BadgeCheck, Check, Code2, Copy, Link2, Mail, QrCode, Share, Share2 } from "lucide-react";
import { renderSVG } from "uqr";
import { LinkedinIcon, XLogoIcon } from "@/components/icons";
import { useT } from "@/components/LocaleProvider";
import type { T } from "@/lib/i18n";
import { Button, buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";

type Kind = "profil" | "prosjekt" | "cv";

async function copy(text: string, t: T, what?: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(what ? t("{what} er kopiert", { what }) : t("Lenken er kopiert"));
    return true;
  } catch {
    toast.error(t("Klarte ikke å kopiere. Merk teksten og kopier den selv."));
    return false;
  }
}

function Snippet({ label, code }: { label: string; code: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <button
          type="button"
          onClick={async () => {
            if (await copy(code, t, label)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm text-ice hover:underline"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {t(copied ? "Kopiert" : "Kopier")}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-ink-2 px-3.5 py-3 font-mono text-[12.5px] leading-5 text-fg/90">{code}</pre>
    </div>
  );
}

// Del-knappen: kopier lenke, del på LinkedIn/X/e-post, QR-kode, merke til en README og
// kode for å bygge inn profilen eller prosjektet på en annen nettside.
export default function ShareMenu({
  path,
  title,
  text,
  kind,
  username,
  projectId,
  label,
  variant = "secondary",
  size = "sm",
  iconOnly = false,
}: {
  path: string;
  title: string;
  text?: string;
  kind: Kind;
  username?: string;
  projectId?: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
}) {
  const t = useT();
  const buttonLabel = label ?? t("Del");
  const [dialog, setDialog] = useState<"qr" | "merke" | "bygg-inn" | null>(null);
  const [origin, setOrigin] = useState("");
  const url = `${origin}${path}`;
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=640,height=640");
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const embedPath = kind === "prosjekt" && projectId ? `/bygg-inn/prosjekt/${projectId}` : username ? `/bygg-inn/profil/${username}` : null;
  const badgeUrl = username ? `${origin}/api/merke/${username}` : "";
  const qrSvg = dialog === "qr" && origin ? renderSVG(url, { border: 2, ecc: "M" }) : "";

  return (
    <>
      <Menu
        label={t("Del")}
        align="end"
        trigger={({ open: isOpen, toggle, id }) => (
          <button
            type="button"
            onClick={() => {
              setOrigin(window.location.origin);
              toggle();
            }}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={isOpen ? id : undefined}
            aria-label={iconOnly ? buttonLabel : undefined}
            className={buttonClass({ variant, size: iconOnly ? (size === "sm" ? "icon-sm" : "icon") : size })}
          >
            {iconOnly ? <Link2 className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
            {!iconOnly && buttonLabel}
          </button>
        )}
      >
        <MenuItem icon={<Copy className="size-4" />} onSelect={() => copy(url, t)}>
          {t("Kopier lenke")}
        </MenuItem>
        <MenuItem icon={<LinkedinIcon className="size-4" />} onSelect={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)}>
          {t("Del på LinkedIn")}
        </MenuItem>
        <MenuItem
          icon={<XLogoIcon className="size-3.5" />}
          onSelect={() => open(`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`)}
        >
          {t("Del på X")}
        </MenuItem>
        <MenuItem
          icon={<Mail className="size-4" />}
          onSelect={() => (window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text ? `${text}\n\n` : ""}${url}`)}`)}
        >
          {t("Send på e-post")}
        </MenuItem>
        {canNativeShare && (
          <MenuItem icon={<Share className="size-4" />} onSelect={() => navigator.share({ title, text, url }).catch(() => {})}>
            {t("Flere valg …")}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={<QrCode className="size-4" />} onSelect={() => setDialog("qr")}>
          {t("QR-kode")}
        </MenuItem>
        {kind === "profil" && username && (
          <MenuItem icon={<BadgeCheck className="size-4" />} onSelect={() => setDialog("merke")}>
            {t("Merke til GitHub-README")}
          </MenuItem>
        )}
        {kind !== "cv" && embedPath && (
          <MenuItem icon={<Code2 className="size-4" />} onSelect={() => setDialog("bygg-inn")}>
            {t("Bygg inn på nettsiden din")}
          </MenuItem>
        )}
      </Menu>

      <Dialog open={dialog === "qr"} onClose={() => setDialog(null)} title={t("QR-kode")} description={t("Til CV-en på papir, et visittkort eller en plakat på standen.")} size="sm">
        <div className="mt-5 flex flex-col items-center">
          {/* SVG-en lages av uqr fra en lenke vi selv bygger, uten brukerinnhold i markeringen. */}
          <div className="w-56 rounded-2xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-3 break-all text-center text-xs text-mist">{url.replace(/^https?:\/\//, "")}</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            onClick={() => {
              const blob = new Blob([qrSvg], { type: "image/svg+xml" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `vis-${username ?? projectId ?? "qr"}.svg`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            {t("Last ned (SVG)")}
          </Button>
        </div>
      </Dialog>

      {username && (
        <Dialog
          open={dialog === "merke"}
          onClose={() => setDialog(null)}
          title={t("Merke til README")}
          description={t("Lim det inn øverst i README-en på GitHub-profilen din, så finner folk porteføljen din derfra.")}
        >
          {dialog === "merke" && (
            <>
              <div className="mt-5 rounded-2xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badgeUrl} alt={t("Vis-merke")} height={20} />
              </div>
              <Snippet label="Markdown" code={`[![Vis](${badgeUrl})](${origin}/@${username})`} />
              <Snippet label="HTML" code={`<a href="${origin}/@${username}"><img src="${badgeUrl}" alt="${t("Profilen min på Vis")}" height="20"></a>`} />
            </>
          )}
        </Dialog>
      )}

      {embedPath && (
        <Dialog
          open={dialog === "bygg-inn"}
          onClose={() => setDialog(null)}
          title={t("Bygg inn på nettsiden din")}
          description={t("Et lite kort som alltid er oppdatert. Lim koden inn der du vil vise det.")}
          size="lg"
        >
          {dialog === "bygg-inn" && (
            <>
              <iframe
                src={embedPath}
                title={t("Forhåndsvisning")}
                className={`mt-5 w-full max-w-[560px] rounded-2xl border-0 ${kind === "prosjekt" ? "h-[400px]" : "h-[300px]"}`}
                loading="lazy"
              />
              <Snippet
                label="HTML"
                code={`<iframe src="${origin}${embedPath}" title="${title.replace(/"/g, "&quot;")}" width="100%" height="${kind === "prosjekt" ? 400 : 300}" style="border:0;border-radius:16px;max-width:560px" loading="lazy"></iframe>`}
              />
              <p className="mt-3 text-xs text-mist">
                {t("Legg til")} <code className="font-mono">?tema=lys</code> {t("i adressen for lys bakgrunn.")}
              </p>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
