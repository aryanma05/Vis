"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Ban, Bookmark, Eye, FileText, ListX, Mail, Undo2 } from "lucide-react";
import { blockCompanyAction, removeMeFromCompanyListsAction, unblockCompanyAction } from "@/app/actions/company-privacy";
import { useLocale, useT } from "@/components/LocaleProvider";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

const EASE = [0.16, 1, 0.3, 1] as const;

type Chip = { key: string; icon: React.ReactElement; text: string; tone: string };

export type Relation = {
  company: { id: string; name: string; slug: string; logoUrl: string | null; verified: boolean };
  saved: { lists: number; at: string } | null;
  contacted: { count: number; at: string } | null;
  applied: { count: number; at: string } | null;
  viewedAt: string | null;
  blockedAt: string | null;
};

// Én rad per bedrift: hva som har skjedd, og «Fjern meg fra listene» og «Blokker».
export default function CompanyRelations({ relations }: { relations: Relation[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const reduce = useReduceMotion();
  const [pending, start] = useTransition();
  const [blocking, setBlocking] = useState<Relation | null>(null);
  const date = (iso: string) => formatDate(iso, locale, "short");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? t("Noe gikk galt."));
      toast.success(done);
      router.refresh();
    });

  return (
    <>
      <ul className="space-y-3">
        {relations.map((r, i) => {
          const chips = ([
            r.saved && { key: "saved", icon: <Bookmark className="size-3" />, text: r.saved.lists > 1 ? t("Lagret i {n} lister", { n: r.saved.lists }) : t("Lagret i en liste"), tone: "bg-sea/15 text-sea" },
            r.contacted && { key: "contacted", icon: <Mail className="size-3" />, text: t("Kontaktet deg {date}", { date: date(r.contacted.at) }), tone: "bg-warn/15 text-warn" },
            r.applied && { key: "applied", icon: <FileText className="size-3" />, text: t("Søknad {date}", { date: date(r.applied.at) }), tone: "bg-success/15 text-success" },
            r.viewedAt && { key: "viewed", icon: <Eye className="size-3" />, text: t("Åpnet søknaden {date}", { date: date(r.viewedAt) }), tone: "bg-fill text-mist" },
          ] as (Chip | null | "")[]).filter((c): c is Chip => Boolean(c));
          return (
            <motion.li
              key={r.company.id}
              initial={{ opacity: 0, y: reduce ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: reduce ? 0 : Math.min(i, 10) * 0.04 }}
              className={`rounded-[22px] glass-card p-4 sm:p-5 ${r.blockedAt ? "ring-1 ring-danger/30" : ""}`}
            >
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-fill text-lg font-bold text-mist">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.company.logoUrl ? <img src={r.company.logoUrl} alt="" className="size-full object-cover" /> : r.company.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/bedrift/${r.company.slug}`} className="font-semibold hover:text-ice">
                      {r.company.name}
                    </Link>
                    {r.company.verified ? (
                      <BadgeCheck className="size-4 text-sea" aria-label={t("Bekreftet bedrift")} />
                    ) : (
                      <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-mist">{t("Ikke bekreftet")}</span>
                    )}
                    {r.blockedAt && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
                        <Ban className="size-3" /> {t("Blokkert {date}", { date: date(r.blockedAt) })}
                      </span>
                    )}
                  </div>
                  {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chips.map((c) => (
                        <span key={c.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.tone}`}>
                          {c.icon} {c.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                  {r.saved && !r.blockedAt && (
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => run(() => removeMeFromCompanyListsAction(r.company.id), "Du er fjernet fra listene deres")}
                    >
                      <ListX className="size-3.5" /> {t("Fjern meg fra listene")}
                    </Button>
                  )}
                  {r.blockedAt ? (
                    <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => unblockCompanyAction(r.company.id), "Blokkeringen er opphevet")}>
                      <Undo2 className="size-3.5" /> {t("Opphev blokkering")}
                    </Button>
                  ) : (
                    <Button size="xs" variant="ghost" className="hover:text-danger" disabled={pending} onClick={() => setBlocking(r)}>
                      <Ban className="size-3.5" /> {t("Blokker")}
                    </Button>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      <Dialog
        open={blocking !== null}
        onClose={() => setBlocking(null)}
        size="sm"
        title={blocking ? t("Blokkere {name}?", { name: blocking.company.name }) : ""}
        description={t("De finner deg ikke i kandidatsøket, kan ikke lagre deg i lister eller kontakte deg, og du fjernes fra listene deres med en gang. De får ikke vite det.")}
      >
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setBlocking(null)}>
            {t("Avbryt")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={pending}
            onClick={() => {
              const target = blocking;
              setBlocking(null);
              if (target) run(() => blockCompanyAction(target.company.id), "Bedriften er blokkert");
            }}
          >
            <Ban className="size-4" /> {t("Blokker")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
