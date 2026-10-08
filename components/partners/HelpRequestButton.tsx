"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HandHeart } from "lucide-react";
import { sendPartnerRequestAction } from "@/app/actions/partners";
import { useT } from "@/components/LocaleProvider";
import { Button, ButtonLink, buttonClass, type ButtonSize } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { type Commitment, COMMITMENT_LABELS } from "@/lib/constants";

const MIN = 20;
const MAX = 1500;

// «Tilby hjelp» på en utlysning: velg hvor mye du vil bidra og skriv litt om deg selv.
// Eieren får det som varsel og på e-post, og kan si ja eller nei.
export default function HelpRequestButton({
  postId,
  title,
  ownerName,
  commitments,
  loggedIn,
  size = "md",
  className = "",
}: {
  postId: string;
  title: string;
  ownerName: string;
  commitments: Commitment[];
  loggedIn: boolean;
  size?: ButtonSize;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [commitment, setCommitment] = useState<Commitment>(commitments[0] ?? "del");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = ownerName.split(" ")[0] || ownerName;
  const next = encodeURIComponent(`/partnere/${postId}`);

  const send = () =>
    start(async () => {
      setError(null);
      const result = await sendPartnerRequestAction(postId, { commitment, message });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setMessage("");
      toast.success(t("Forespørselen er sendt til {name}", { name: first }), { description: t("Du får et varsel når de svarer.") });
      router.refresh();
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass({ size, className })}>
        <HandHeart className="size-4" /> {t("Tilby hjelp")}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Bli med på «{title}»", { title })}
        description={loggedIn ? t("{name} får forespørselen som varsel og på e-post, og kan si ja eller nei.", { name: first }) : undefined}
      >
        {!loggedIn ? (
          <div className="mt-5">
            <p className="text-sm leading-6 text-mist">{t("Logg inn for å tilby hjelp. Da ser {name} hvem du er og hva du har laget.", { name: first })}</p>
            <div className="mt-5 flex gap-2">
              <ButtonLink href={`/logg-inn?neste=${next}`} size="sm">
                {t("Logg inn")}
              </ButtonLink>
              <ButtonLink href="/register" size="sm" variant="secondary">
                {t("Lag profil")}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-fg">{t("Hvor mye vil du bidra?")}</p>
            <div role="radiogroup" aria-label={t("Hvor mye vil du bidra?")} className="grid gap-2">
              {commitments.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={commitment === c}
                  onClick={() => setCommitment(c)}
                  className={`flex items-start gap-3 rounded-[16px] px-4 py-3 text-left transition ${commitment === c ? "bg-primary/10 ring-2 ring-primary/60" : "glass-chip hover:bg-fill-2"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1 size-3.5 shrink-0 rounded-full ${commitment === c ? "bg-primary ring-4 ring-primary/25" : "inset-ring-2 inset-ring-line"}`}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-fg">{t(COMMITMENT_LABELS[c].label)}</span>
                    <span className="block text-[13px] text-mist">{t(COMMITMENT_LABELS[c].description)}</span>
                  </span>
                </button>
              ))}
            </div>
            <label htmlFor="hjelp-melding" className="mb-2 mt-5 block text-sm font-medium text-fg">
              {t("Hvem er du, og hva kan du bidra med?")}
            </label>
            <textarea
              id="hjelp-melding"
              className={`${textareaClass} min-h-32`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX}
              placeholder={t("Hei {name}! Jeg driver med … og kunne tenke meg å hjelpe med …", { name: first })}
            />
            <p className="mt-1.5 flex justify-between gap-4 text-xs text-mist">
              <span>{t("Navnet, profilen og e-postadressen din deles med {name}.", { name: first })}</span>
              <span className="shrink-0 tabular-nums">{message.trim().length < MIN ? t("minst {n} tegn", { n: MIN }) : `${message.length}/${MAX}`}</span>
            </p>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t("Avbryt")}
              </Button>
              <Button size="sm" onClick={send} loading={pending} disabled={message.trim().length < MIN}>
                {t("Send forespørsel")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
