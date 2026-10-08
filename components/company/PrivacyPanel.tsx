"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, FileSignature, Lock } from "lucide-react";
import { acceptCompanyTermsAction, setRetentionMonthsAction } from "@/app/actions/company-privacy";
import { useLocale } from "@/components/LocaleProvider";
import { useRun } from "@/components/company/useRun";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button, ButtonLink } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/tabs";
import { RETENTION_OPTIONS } from "@/lib/company-labels";
import { formatDate } from "@/lib/format";

const EASE = [0.16, 1, 0.3, 1] as const;

// Det viktigste i databehandleravtalen, vist før man godtar. Hele teksten: /vilkar/databehandleravtale.
const TERMS_SUMMARY = [
  "Bedriften er behandlingsansvarlig for søknader, lister, notater og meldinger. Vis er databehandler.",
  "Vis bruker opplysningene bare til å levere tjenesten, etter bedriftens instruks.",
  "Alt som skjer med kandidatdata logges, og dere kan kreve tofaktor for alle i bedriften.",
  "Vis varsler om avvik uten ugrunnet opphold, med mål om under 24 timer.",
  "Slettes bedriften, slettes dataene innen 30 dager.",
];

/* -------------------------------------------------------------------------- */
/*  Databehandleravtalen                                                      */
/* -------------------------------------------------------------------------- */

export function TermsCard({
  companyId,
  companyName,
  acceptedAt,
  acceptedBy,
  version,
  current,
}: {
  companyId: string;
  companyName: string;
  acceptedAt: string | null;
  acceptedBy: { name: string; username: string } | null;
  version: string | null;
  current: string;
}) {
  const { pending, run, t } = useRun();
  const locale = useLocale();
  const reduce = useReduceMotion();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const upToDate = acceptedAt !== null && version === current;

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`rounded-[22px] glass-card p-5 ${upToDate ? "" : "ring-1 ring-warn/40"}`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${upToDate ? "bg-success/15 text-success" : "bg-warn/15 text-warn"}`}>
          <FileSignature className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{t("Databehandleravtale")}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${upToDate ? "bg-success/15 text-success" : "bg-warn/15 text-warn"}`}>
              {upToDate ? t("Godtatt") : acceptedAt ? t("Ny versjon") : t("Mangler")}
            </span>
          </div>
          {acceptedAt ? (
            <p className="mt-1 text-sm text-mist">
              {acceptedBy
                ? t("Versjon {version}, godtatt {date} av {name}.", { version: version ?? "–", date: formatDate(acceptedAt, locale), name: acceptedBy.name })
                : t("Versjon {version}, godtatt {date}.", { version: version ?? "–", date: formatDate(acceptedAt, locale) })}
              {!upToDate && ` ${t("Les gjennom endringene og godta den nye versjonen.")}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-mist">{t("Må godtas før dere kan publisere stillinger, bruke kandidatsøket, kontakte kandidater eller kjøpe Bedrift.")}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!upToDate && (
              <Button size="sm" onClick={() => setOpen(true)}>
                {t("Les og godta")}
              </Button>
            )}
            <Link href="/vilkar/databehandleravtale" target="_blank" className="text-sm text-ice hover:underline">
              {t("Les hele avtalen")}
            </Link>
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Databehandleravtale")}
        description={t("Versjon {version}. Dette er det viktigste; hele avtalen ligger på egen side.", { version: current })}
      >
        <ul className="mt-5 space-y-2.5">
          {TERMS_SUMMARY.map((line) => (
            <li key={line} className="flex gap-2.5 text-sm leading-6">
              <Check className="mt-1 size-4 shrink-0 text-success" />
              <span>{t(line)}</span>
            </li>
          ))}
        </ul>
        <Link href="/vilkar/databehandleravtale" target="_blank" className="mt-4 inline-block text-sm text-ice hover:underline">
          {t("Les hele avtalen")}
        </Link>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[14px] bg-fill p-3.5 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 accent-[var(--sea)]" />
          <span>{t("Jeg har lest avtalen og har rett til å godta den på vegne av {name}.", { name: companyName })}</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t("Avbryt")}
          </Button>
          <Button
            size="sm"
            loading={pending}
            disabled={!agreed}
            onClick={() => {
              setOpen(false);
              run(() => acceptCompanyTermsAction(companyId), "Databehandleravtalen er godtatt");
            }}
          >
            {t("Godta avtalen")}
          </Button>
        </div>
      </Dialog>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lagringstid                                                               */
/* -------------------------------------------------------------------------- */

export function RetentionPicker({ companyId, months, business, base }: { companyId: string; months: number; business: boolean; base: string }) {
  const { pending, run, t } = useRun();
  const [value, setValue] = useState(String(business ? months : 6));
  const options = RETENTION_OPTIONS.map((m) => ({ value: String(m), label: t("{n} mnd", { n: m }) }));

  return (
    <div>
      <div className={`flex flex-wrap items-center gap-3 ${pending ? "opacity-60" : ""}`}>
        {business ? (
          <Segmented
            label={t("Lagringstid etter at stillingen er lukket")}
            options={options}
            value={value}
            onChange={(next) => {
              if (next === value) return;
              setValue(next);
              run(() => setRetentionMonthsAction(companyId, Number(next)), "Lagringstiden er endret");
            }}
          />
        ) : (
          <>
            <div aria-disabled="true" className="glass-chip pointer-events-none inline-flex rounded-full p-1 opacity-60">
              {options.map((o) => (
                <span key={o.value} className={`rounded-full px-4 py-1.5 text-sm font-medium ${o.value === "6" ? "glass-thumb text-fg" : "text-mist"}`}>
                  {o.label}
                </span>
              ))}
            </div>
            <Link href={`${base}?fane=abonnement`} className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-xs font-medium text-mist hover:text-fg">
              <Lock className="size-3.5" /> {t("Velg selv med Bedrift")}
            </Link>
          </>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-5 text-mist">
        {business
          ? t("Gjelder fra neste natt. Kortere tid gjelder også søknader dere allerede har; lengre tid forlenger aldri noe som er regnet ut.")
          : t("Gratis: søknader slettes 6 måneder etter at stillingen er lukket.")}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Avtalen mangler                                                           */
/* -------------------------------------------------------------------------- */

// Vises i stedet for kandidatsøket til databehandleravtalen er godtatt. Eier og administratorer
// får en snarvei; andre får beskjed om hvem som kan godta den.
export function TermsRequired({ base, canAccept }: { base: string; canAccept: boolean }) {
  const { t } = useRun();
  return (
    <div className="mx-auto max-w-xl rounded-[22px] glass-card p-6 text-center md:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warn/15 text-warn">
        <FileSignature className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{t("Godta databehandleravtalen først")}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-6 text-mist">
        {canAccept
          ? t("Bedriften er behandlingsansvarlig for kandidatene dere finner. Avtalen tar ett klikk, og gjelder hele bedriften.")
          : t("En eier eller administrator må godta avtalen under Personvern og logg før dere kan bruke kandidatsøket.")}
      </p>
      {canAccept && (
        <div className="mt-6 flex justify-center">
          <ButtonLink href={`${base}?fane=personvern`} size="sm">
            {t("Gå til Personvern og logg")}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
