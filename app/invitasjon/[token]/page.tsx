import type { Metadata } from "next";
import Link from "next/link";
import { CircleX, Clock, LogIn, Mail, MailCheck, UserPlus } from "lucide-react";
import { InviteCard } from "@/components/company/PendingInvites";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getInviteByToken } from "@/lib/company-invites";
import type { InviteStatus } from "@/lib/company-labels";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import InviteResponse from "./InviteResponse";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Invitasjon"), robots: { index: false } };
}

// Det som står når lenken ikke (lenger) kan brukes.
function gone(status: Exclude<InviteStatus, "pending">, t: T) {
  switch (status) {
    case "accepted":
      return { title: t("Invitasjonen er allerede brukt"), text: t("Lenken kan bare brukes én gang. Er det deg som godtok, finner du bedriften under Invitasjoner.") };
    case "declined":
      return { title: t("Invitasjonen er avslått"), text: t("Ombestemt deg? Be bedriften sende en ny invitasjon.") };
    case "revoked":
      return { title: t("Invitasjonen er trukket tilbake"), text: t("Bedriften har trukket tilbake invitasjonen. Ta kontakt med dem hvis det er feil.") };
    default:
      return { title: t("Invitasjonen har utløpt"), text: t("Invitasjoner gjelder i 7 dager. Be bedriften sende en ny.") };
  }
}

// /invitasjon/[token]: lenken fra e-posten. Viser bedriften og rollen uten å avsløre hele
// e-postadressen. Godta krever innlogging med akkurat den adressen, bekreftet; avslå virker
// med lenken alene.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, user, t] = await Promise.all([params, getCurrentUser(), getT()]);
  const invite = await getInviteByToken(String(token), user?.id ?? null);
  const here = `/invitasjon/${encodeURIComponent(String(token))}`;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-xl">
        <p className="caption">{t("Invitasjon")}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          {invite && invite.status === "pending" ? t("Du er invitert til {name}", { name: invite.company.name }) : t("Invitasjon til en bedrift")}
        </h1>

        <div className="fade-up mt-8">
          {!invite ? (
            <EmptyState icon={<CircleX className="size-5" />} title={t("Fant ikke invitasjonen")}>
              {t("Lenken er ugyldig eller ikke lenger i bruk. Be bedriften sende en ny invitasjon.")}
            </EmptyState>
          ) : invite.status !== "pending" ? (
            <EmptyState
              icon={invite.status === "expired" ? <Clock className="size-5" /> : <CircleX className="size-5" />}
              title={gone(invite.status, t).title}
              action={
                <ButtonLink href={`/bedrift/${invite.company.slug}`} variant="secondary" size="sm">
                  {t("Se bedriftssiden")}
                </ButtonLink>
              }
            >
              {gone(invite.status, t).text}
            </EmptyState>
          ) : (
            <InviteCard
              invite={invite}
              t={t}
              footer={
                <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-4 text-[13px] text-mist">
                  <Mail className="size-3.5" aria-hidden="true" /> {t("Sendt til {email}", { email: invite.emailMasked })}
                </p>
              }
            >
              {!user ? (
                <div className="space-y-4">
                  <p className="text-sm text-mist">{t("Logg inn eller lag en konto med e-postadressen invitasjonen ble sendt til, så kan du svare.")}</p>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/logg-inn?neste=${encodeURIComponent(here)}`} size="sm">
                      <LogIn className="size-4" /> {t("Logg inn for å svare")}
                    </ButtonLink>
                    <ButtonLink href={`/register?neste=${encodeURIComponent(here)}`} size="sm" variant="secondary">
                      <UserPlus className="size-4" /> {t("Lag konto")}
                    </ButtonLink>
                  </div>
                  <div className="border-t border-line pt-4">
                    <p className="mb-2 text-[13px] text-mist">{t("Vil du ikke bli med? Du kan avslå uten å logge inn.")}</p>
                    <InviteResponse token={token} kind={invite.kind} companySlug={invite.company.slug} canAccept={false} />
                  </div>
                </div>
              ) : invite.viewer === "match" ? (
                <InviteResponse token={token} kind={invite.kind} companySlug={invite.company.slug} />
              ) : invite.viewer === "unverified" ? (
                <div className="space-y-3">
                  <p className="flex items-start gap-2 rounded-[16px] bg-warn/10 px-4 py-3 text-sm text-fg/90">
                    <MailCheck className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
                    {t("Bekreft e-postadressen din først, så kan du svare på invitasjonen.")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href="/profil/rediger/konto" size="sm">
                      {t("Bekreft e-posten")}
                    </ButtonLink>
                    <InviteResponse token={token} kind={invite.kind} companySlug={invite.company.slug} canAccept={false} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="flex items-start gap-2 rounded-[16px] bg-warn/10 px-4 py-3 text-sm text-fg/90">
                    <Mail className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
                    <span>
                      {t("Invitasjonen ble sendt til en annen e-postadresse.")} {t("Logg inn med {email} for å godta.", { email: invite.emailMasked })}
                    </span>
                  </p>
                  <p className="text-[13px] text-mist">
                    {t("Innlogget som @{username}.", { username: user.username })}{" "}
                    <Link href="/invitasjoner" className="font-medium text-ice hover:underline">
                      {t("Se invitasjonene dine")}
                    </Link>
                  </p>
                </div>
              )}
            </InviteCard>
          )}
        </div>
      </div>
    </main>
  );
}
