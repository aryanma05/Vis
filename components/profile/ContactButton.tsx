"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { sendContactAction } from "@/app/actions/contact";
import { useT } from "@/components/LocaleProvider";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { CONTACT_REASON_LABELS, CONTACT_REASONS, type ContactReason } from "@/lib/constants";

const MIN = 20;
const MAX = 2000;

// «Kontakt meg» på profilen. Krever innlogging, så meldingen alltid har en avsender.
export default function ContactButton({ recipientId, name, loggedIn }: { recipientId: string; name: string; loggedIn: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContactReason>("jobb");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = name.split(" ")[0] || name;

  const send = () =>
    start(async () => {
      setError(null);
      const result = await sendContactAction(recipientId, { reason, message });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setMessage("");
      toast.success(t("Meldingen er sendt til {name}", { name: first }), { description: t("Svaret kommer på e-post.") });
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass({ variant: "secondary", size: "sm" })}>
        <Mail className="size-4" /> {t("Kontakt")}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Kontakt {name}", { name: first })}
        description={loggedIn ? t("{name} får meldingen som varsel og på e-post, og kan svare deg direkte.", { name: first }) : undefined}
      >
        {!loggedIn ? (
          <div className="mt-5">
            <p className="text-sm leading-6 text-mist">{t("Logg inn for å sende en melding. Da vet {name} hvem som tar kontakt.", { name: first })}</p>
            <div className="mt-5 flex gap-2">
              <ButtonLink href="/logg-inn" size="sm">
                {t("Logg inn")}
              </ButtonLink>
              <ButtonLink href="/register" size="sm" variant="secondary">
                {t("Lag profil")}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div role="radiogroup" aria-label={t("Hva gjelder det?")} className="flex flex-wrap gap-2">
              {CONTACT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${reason === r ? "bg-primary text-on-primary" : "glass-chip text-fg"}`}
                >
                  {t(CONTACT_REASON_LABELS[r])}
                </button>
              ))}
            </div>
            <label htmlFor="kontakt-melding" className="sr-only">
              {t("Melding")}
            </label>
            <textarea
              id="kontakt-melding"
              className={`${textareaClass} mt-4 min-h-36`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX}
              placeholder={t("Hei {name}! Jeg så prosjektene dine og lurte på …", { name: first })}
            />
            <p className="mt-1.5 flex justify-between text-xs text-mist">
              <span>{t("Navnet, profilen og e-postadressen din deles med {name}.", { name: first })}</span>
              <span className="tabular-nums">{message.trim().length < MIN ? t("minst {n} tegn", { n: MIN }) : `${message.length}/${MAX}`}</span>
            </p>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t("Avbryt")}
              </Button>
              <Button size="sm" onClick={send} loading={pending} disabled={message.trim().length < MIN}>
                {t("Send melding")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
