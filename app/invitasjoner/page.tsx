import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Building2, ChevronRight, Inbox } from "lucide-react";
import PendingInvites from "@/components/company/PendingInvites";
import { RemoveEmployee } from "@/components/company/TeamTools";
import { ROLE_TONE } from "@/components/company/tones";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { listMyCompanies, listMyTeams } from "@/lib/companies";
import { ROLE_LABEL } from "@/lib/company-labels";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Invitasjoner"), robots: { index: false } };
}

function Logo({ url }: { url: string | null }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-fill">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <Building2 className="size-4 text-mist" />}
    </span>
  );
}

// /invitasjoner: invitasjoner fra bedrifter som venter på svar, og bedriftene du allerede er med i.
export default async function InvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn?neste=/invitasjoner");
  const [t, companies, teams] = await Promise.all([getT(), listMyCompanies(user.id), listMyTeams(user.id)]);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <p className="caption">{t("Bedrifter")}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{t("Invitasjoner")}</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-6 text-mist">
          {t("Ingen får tilgang til en bedrift eller vises i teamet deres uten å ha sagt ja. Her svarer du på invitasjonene.")}
        </p>

        <div className="mt-8">
          <PendingInvites
            userId={user.id}
            all
            empty={
              <EmptyState icon={<Inbox className="size-5" />} title={t("Ingen invitasjoner venter")}>
                {t("Når en bedrift inviterer deg til administrasjonen eller teamet sitt, dukker det opp her og under Varsler.")}
              </EmptyState>
            }
          />
        </div>

        {companies.length > 0 && (
          <section className="fade-up mt-12" style={{ animationDelay: "120ms" }}>
            <h2 className="caption">{t("Bedrifter du har tilgang til")}</h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link href={`/bedrift/${c.slug}/admin`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-fill">
                    <Logo url={c.logoUrl} />
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
                      <span className="truncate">{c.name}</span>
                      {c.verifiedAt && <BadgeCheck className="size-4 shrink-0 text-sea" aria-label={t("Bekreftet av Vis")} />}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_TONE[c.role]}`}>{t(ROLE_LABEL[c.role])}</span>
                    <ChevronRight className="size-4 shrink-0 text-mist" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {teams.length > 0 && (
          <section className="fade-up mt-10" style={{ animationDelay: "180ms" }}>
            <h2 className="caption">{t("Team du vises i")}</h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
              {teams.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <Logo url={c.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/bedrift/${c.slug}`} className="block truncate font-medium hover:text-ice">
                      {c.name}
                    </Link>
                    {c.title && <p className="truncate text-[13px] text-mist">{c.title}</p>}
                  </div>
                  <RemoveEmployee companyId={c.id} self />
                </li>
              ))}
            </ul>
          </section>
        )}

        {companies.length === 0 && teams.length === 0 && (
          <p className="mt-10 text-sm text-mist">
            {t("Vil du rekruttere på Vis?")}{" "}
            <ButtonLink href="/bedrifter" variant="link" className="text-sm">
              {t("Les om Vis for bedrifter")}
            </ButtonLink>
          </p>
        )}
      </div>
    </main>
  );
}
