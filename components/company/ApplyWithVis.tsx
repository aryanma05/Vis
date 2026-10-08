"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, CheckCircle2, FolderPlus, ShieldCheck } from "lucide-react";
import { applyToJobAction, withdrawApplicationAction } from "@/app/actions/applications";
import Avatar from "@/components/Avatar";
import { useLocale, useT } from "@/components/LocaleProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants";
import { dateLocale } from "@/lib/i18n";

type PickerProject = { id: string; title: string; role: string | null; cover: string | null };
type Viewer = { name: string; username: string; image: string | null; headline: string | null };
type Existing = { id: string; status: ApplicationStatus; createdAt: Date | string } | null;

const MAX = 3;

// «Søk med Vis-profilen» på stillingssiden: velg opptil tre prosjekter som viser at du
// passer, skriv en kort melding (valgfritt) og send. Etterpå vises statusen her.
export default function ApplyWithVis({
  jobId,
  jobTitle,
  companyName,
  viewer,
  projects,
  existing,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  viewer: Viewer | null;
  projects: PickerProject[];
  existing: Existing;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(projects.slice(0, 1).map((p) => p.id));
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  if (!viewer) {
    return (
      <ButtonLink href={`/logg-inn?neste=${encodeURIComponent(`/stillinger/${jobId}`)}`} className="mt-5 w-full">
        {t("Søk med Vis-profilen")}
      </ButtonLink>
    );
  }

  if (existing && existing.status !== "trukket") {
    const date = new Date(existing.createdAt).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long" });
    return (
      <div className="mt-5 rounded-2xl bg-fill p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-fg">
          <CheckCircle2 className="size-4 text-success" /> {t("Du søkte {date}", { date })}
        </p>
        <p className="mt-1 text-mist">
          {t("Status")}: <span className="font-medium text-fg">{t(APPLICATION_STATUS_LABELS[existing.status])}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/soknader" className="font-medium text-ice hover:underline">
            {t("Alle søknadene dine")}
          </Link>
          {existing.status !== "avslag" && (
            <button
              type="button"
              disabled={pending}
              className="text-mist hover:text-danger"
              onClick={() =>
                window.confirm(t("Trekke søknaden?")) &&
                start(async () => {
                  const result = await withdrawApplicationAction(existing.id);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(t("Søknaden er trukket"));
                  router.refresh();
                })
              }
            >
              {t("Trekk søknaden")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length >= MAX ? list : [...list, id]));

  const submit = () =>
    start(async () => {
      const result = await applyToJobAction(jobId, { message, projectIds: picked });
      if (!result.ok) return void toast.error(result.error);
      setOpen(false);
      toast.success(t("Søknaden er sendt"), { description: t("Du får beskjed her og på e-post når {company} svarer.", { company: companyName }) });
      router.refresh();
    });

  return (
    <>
      <Button className="mt-5 w-full" onClick={() => setOpen(true)}>
        {t("Søk med Vis-profilen")}
      </Button>
      <p className="mt-2 text-center text-xs text-mist">{t("Ingen CV eller søknadsbrev. Profilen og prosjektene dine er søknaden.")}</p>

      <Dialog open={open} onClose={() => setOpen(false)} size="lg" title={t("Søk på {title}", { title: jobTitle })} description={t("Dette er det {company} får se.", { company: companyName })}>
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-2xl bg-fill p-3">
            <Avatar name={viewer.name} image={viewer.image} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-fg">{viewer.name}</p>
              <p className="truncate text-sm text-mist">{viewer.headline ?? `@${viewer.username}`}</p>
            </div>
            <Link href={`/@${viewer.username}`} target="_blank" className="shrink-0 text-sm font-medium text-ice hover:underline">
              {t("Se profilen")}
            </Link>
          </div>

          <div>
            <p className="text-sm font-medium text-fg">{t("Velg opptil tre prosjekter som viser at du passer")}</p>
            {projects.length === 0 ? (
              <div className="mt-2 flex items-start gap-3 rounded-2xl border border-dashed border-line p-4 text-sm text-mist">
                <FolderPlus className="mt-0.5 size-4 shrink-0" />
                <p>
                  {t("Du har ingen publiserte prosjekter ennå. Det er det bedrifter ser først.")}{" "}
                  <Link href="/ny" className="font-medium text-ice hover:underline">
                    {t("Del et prosjekt")}
                  </Link>
                </p>
              </div>
            ) : (
              <ul className="mt-2 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto p-0.5 sm:grid-cols-3">
                {projects.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(p.id)}
                        disabled={!on && picked.length >= MAX}
                        className={`relative block w-full overflow-hidden rounded-2xl text-left transition disabled:opacity-40 ${on ? "ring-2 ring-sea" : "ring-1 ring-line hover:ring-fg/30"}`}
                      >
                        <span className="block aspect-[4/3] bg-fill-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.cover && <img src={p.cover} alt="" className="size-full object-cover" />}
                        </span>
                        <span className="block truncate px-2.5 py-2 text-[13px] font-medium text-fg">{p.title}</span>
                        {on && (
                          <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-on-primary">
                            <Check className="size-3.5" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-fg">{t("Kort melding")}</span> <span className="text-sm text-mist">({t("valgfritt")})</span>
            <textarea
              className={`${textareaClass} mt-2 min-h-28`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={3000}
              placeholder={t("Hvorfor passer du, og hva gjorde du selv i prosjektene?")}
            />
          </label>

          <p className="flex items-start gap-2 text-xs leading-5 text-mist">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            {t("{company} får se profilen, prosjektene, meldingen og e-postadressen din. Du kan trekke søknaden når som helst, og den slettes automatisk etter et år.", {
              company: companyName,
            })}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("Avbryt")}
            </Button>
            <Button onClick={submit} loading={pending}>
              {t("Send søknaden")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
