import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { listCompanyRelations } from "@/lib/company-privacy";
import { makeT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getOwnProfileFlags } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import EditNav from "../../EditNav";
import CompanyRelations from "./CompanyRelations";

export async function generateMetadata(): Promise<Metadata> {
  return { title: makeT(await getLocale())("Bedrifter og deg"), robots: { index: false } };
}

// «Bedrifter og deg»: hvem som har lagret, kontaktet, fått en søknad fra eller åpnet søknaden
// til personen, med «Fjern meg fra listene» og blokkering. Bare personens egne data.
export default async function CompanyRelationsPage() {
  const user = await requireUser();
  const [relations, flags, locale] = await Promise.all([listCompanyRelations(user.id), getOwnProfileFlags(user.id), getLocale()]);
  const t = makeT(locale);
  const saved = relations.filter((r) => r.saved).length;
  const blocked = relations.filter((r) => r.blockedAt).length;

  return (
    <main className="pb-28 md:pb-16 md:pl-24">
      <EditNav active="konto" username={user.username} />
      <div className="mx-auto max-w-3xl px-5 py-10 md:px-10">
        <Link href="/profil/rediger/konto#bedrifter" className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Konto og varsler")}
        </Link>
        <h2 className="fade-up mt-4 text-2xl font-bold tracking-tight md:text-[28px]">{t("Bedrifter og deg")}</h2>
        <p className="fade-up mt-2 max-w-2xl text-[15px] leading-7 text-mist" style={{ animationDelay: "60ms" }}>
          {t("Her ser du bedrifter som har lagret profilen din i en liste, kontaktet deg, fått en søknad fra deg eller åpnet søknaden din. Du kan fjerne deg fra listene deres eller blokkere dem. Bedriften får ikke vite at du har blokkert dem.")}
        </p>

        <ul className="fade-up mt-6 grid grid-cols-3 gap-3" style={{ animationDelay: "120ms" }}>
          {[
            { label: t("Bedrifter"), value: relations.length, tone: "" },
            { label: t("Har lagret deg"), value: saved, tone: saved ? "text-sea" : "" },
            { label: t("Blokkert"), value: blocked, tone: blocked ? "text-danger" : "" },
          ].map((s) => (
            <li key={s.label} className="rounded-[18px] glass-card px-4 py-3">
              <p className={`text-2xl font-bold tabular-nums tracking-tight ${s.tone}`}>{s.value}</p>
              <p className="text-xs text-mist">{s.label}</p>
            </li>
          ))}
        </ul>

        <Link
          href="/profil/rediger"
          className="fade-up mt-3 flex items-center gap-3 rounded-[18px] glass-card px-4 py-3 text-sm transition-colors hover:bg-fill"
          style={{ animationDelay: "160ms" }}
        >
          {flags.visibleToCompanies ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4 text-mist" />}
          <span className="min-w-0 flex-1">
            {flags.visibleToCompanies
              ? t("Du er synlig for bedrifter. Slår du det av, fjernes du fra alle lister med en gang.")
              : t("Du er ikke synlig for bedrifter, så ingen kan finne deg i kandidatsøket eller lagre deg.")}
          </span>
          <span className="shrink-0 text-ice">{t("Endre")}</span>
        </Link>

        <div className="mt-8">
          {relations.length === 0 ? (
            <div className="rounded-[22px] glass-card px-6 py-12 text-center">
              <span className="glass-chip mx-auto flex size-12 items-center justify-center rounded-full text-mist">
                <Building2 className="size-5" />
              </span>
              <p className="mt-4 font-semibold">{t("Ingen bedrifter ennå")}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-mist">{t("Når en bedrift lagrer deg, kontakter deg eller får en søknad fra deg, står den her.")}</p>
            </div>
          ) : (
            <CompanyRelations
              relations={relations.map((r) => ({
                company: r.company,
                saved: r.saved ? { lists: r.saved.lists, at: r.saved.at.toISOString() } : null,
                contacted: r.contacted ? { count: r.contacted.count, at: r.contacted.at.toISOString() } : null,
                applied: r.applied ? { count: r.applied.count, at: r.applied.at.toISOString() } : null,
                viewedAt: r.viewedAt?.toISOString() ?? null,
                blockedAt: r.blockedAt?.toISOString() ?? null,
              }))}
            />
          )}
        </div>

        <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-mist">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
          <span>
            {t("Lister slettes etter 12 måneder, kontaktforespørsler etter 24 måneder og søknader senest 12 måneder etter at du søkte.")}{" "}
            <Link href="/personvern#bedrifter" className="text-ice hover:underline">
              {t("Les mer i personvernerklæringen")}
            </Link>
          </span>
        </p>
      </div>
    </main>
  );
}
