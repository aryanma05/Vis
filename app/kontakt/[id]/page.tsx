import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import Avatar from "@/components/Avatar";
import { ButtonLink } from "@/components/ui/button";
import { CONTACT_REASON_LABELS } from "@/lib/constants";
import { getContactRequest } from "@/lib/contact";
import { timeAgo } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Melding"), robots: { index: false } };
}

export default async function ContactRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [{ id }, t, locale] = await Promise.all([params, getT(), getLocale()]);
  const request = await getContactRequest(user.id, id);
  if (!request) notFound();

  const reason = t(CONTACT_REASON_LABELS[request.reason]);
  const subject = encodeURIComponent(t("Svar fra Vis: {reason}", { reason }));

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-2xl">
        <Link href="/varsler" className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Varsler")}
        </Link>
        <article className="mt-6 rounded-[26px] glass-card p-6 md:p-8">
          <div className="flex items-center gap-4">
            <Avatar name={request.sender.name} image={request.sender.image} size={52} />
            <div className="min-w-0">
              <p className="font-semibold">
                {request.isRecipient ? (
                  <Link href={`/@${request.sender.username}`} className="hover:text-ice">
                    {request.sender.name}
                  </Link>
                ) : (
                  <>{t("Til {name}", { name: request.recipient.name })}</>
                )}
              </p>
              <p className="text-sm text-mist">
                {reason} · <span suppressHydrationWarning>{timeAgo(request.createdAt, locale)}</span>
              </p>
            </div>
          </div>
          <p className="mt-6 whitespace-pre-wrap text-[15px] leading-7 text-fg/90">{request.message}</p>
          {request.isRecipient && (
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
              <ButtonLink href={`mailto:${request.sender.email}?subject=${subject}`} size="sm">
                <Mail className="size-4" /> {t("Svar på e-post")}
              </ButtonLink>
              <ButtonLink href={`/@${request.sender.username}`} size="sm" variant="secondary">
                {t("Se profilen")}
              </ButtonLink>
              <p className="w-full text-xs text-mist">{t("E-postadressen din deles først når du svarer.")}</p>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
