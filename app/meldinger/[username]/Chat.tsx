"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Flag, SendHorizontal } from "lucide-react";
import { markMessagesReadAction, sendMessageAction } from "@/app/actions/messages";
import { useLocale, useT } from "@/components/LocaleProvider";
import ReportDialog from "@/components/moderation/ReportDialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { timeAgo } from "@/lib/format";

type Message = { id: string; body: string; mine: boolean; unread: boolean; createdAt: Date };

const MAX = 2000;
// shortcut: nye meldinger hentes ved å spørre serveren hvert 5. sekund mens fanen er synlig; bytt til push (SSE/websocket) hvis det blir mange samtidige samtaler.
const POLL_MS = 5000;

export default function Chat({ friendId, friendName, messages, canSend }: { friendId: string; friendName: string; messages: Message[]; canSend: boolean }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [pending, start] = useTransition();
  // Meldingen vises med en gang, før serveren har svart.
  const [shown, addShown] = useOptimistic(messages, (list, m: Message) => [...list, m]);
  const listRef = useRef<HTMLOListElement>(null);
  const hasUnread = messages.some((m) => m.unread);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  // Markeres som lest når samtalen faktisk er åpen (ikke ved forhåndslasting), så tallet i menyen oppdateres.
  useEffect(() => {
    if (hasUnread) markMessagesReadAction(friendId).then(() => router.refresh());
  }, [hasUnread, friendId, router]);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    setText("");
    setError(null);
    start(async () => {
      addShown({ id: `ny-${Date.now()}`, body, mine: true, unread: false, createdAt: new Date() });
      const result = await sendMessageAction(friendId, body);
      if (!result.ok) {
        setError(result.error);
        setText(body);
      }
    });
  };

  return (
    <div className="mt-6">
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-[13px] text-mist transition hover:text-danger">
          <Flag className="size-3.5" /> {t("Rapporter")}
        </button>
      </div>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="user" targetId={friendId} loggedIn />
      <ol ref={listRef} aria-label={t("Meldinger")} className="flex h-[min(60vh,560px)] flex-col gap-2 overflow-y-auto rounded-[22px] glass-card p-4">
        {shown.length === 0 && <li className="m-auto text-sm text-mist">{t("Ingen meldinger ennå. Si hei til {name}!", { name: friendName.split(" ")[0] })}</li>}
        {shown.map((m) => (
          <li key={m.id} className={`flex max-w-[80%] flex-col ${m.mine ? "items-end self-end" : "items-start self-start"}`}>
            <p
              className={`whitespace-pre-wrap break-words rounded-[20px] px-4 py-2 text-[15px] leading-6 ${
                m.mine ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md glass-chip text-fg"
              }`}
            >
              {m.body}
            </p>
            <span className="mt-0.5 px-1 text-[11px] text-mist/70" suppressHydrationWarning>
              {timeAgo(m.createdAt, locale)}
            </span>
          </li>
        ))}
      </ol>

      {canSend ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="melding" className="sr-only">
            {t("Melding")}
          </label>
          <textarea
            id="melding"
            rows={1}
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sender, Shift+Enter gir ny linje.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t("Skriv en melding …")}
            className={`${inputClass} max-h-40 min-h-11 flex-1 resize-none leading-6`}
          />
          <Button type="submit" size="icon" disabled={!text.trim()} aria-label={t("Send")}>
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-mist">{t("Dere må følge hverandre for å sende meldinger.")}</p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
