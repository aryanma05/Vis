import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import Avatar from "@/components/Avatar";
import { EmptyState } from "@/components/ui/misc";
import { timeAgo } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import { listConversations } from "@/lib/messages";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Meldinger"), robots: { index: false } };
}

export default async function MessagesPage() {
  const user = await requireUser();
  const [friends, t, locale] = await Promise.all([listConversations(user.id), getT(), getLocale()]);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <p className="caption">{t("Innboks")}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{t("Meldinger")}</h1>

        {friends.length === 0 ? (
          <EmptyState className="mt-10" icon={<MessageCircle className="size-5" />} title={t("Ingen venner ennå")}>
            {t("Når du og noen andre følger hverandre, kan dere sende meldinger her.")}
          </EmptyState>
        ) : (
          <ul className="mt-8 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {friends.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/meldinger/${f.username}`}
                  className={`flex items-center gap-4 px-4 py-4 transition hover:bg-surface/70 md:px-5 ${f.unread > 0 ? "bg-sea/[0.06]" : ""}`}
                >
                  <Avatar name={f.name} image={f.image} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold text-fg">{f.name}</span>
                      {f.lastAt && (
                        <span className="shrink-0 text-xs text-mist/70" suppressHydrationWarning>
                          {timeAgo(f.lastAt, locale)}
                        </span>
                      )}
                    </p>
                    <p className={`truncate text-sm ${f.unread > 0 ? "font-medium text-fg" : "text-mist"}`}>
                      {f.lastBody ? `${f.lastMine ? `${t("Du")}: ` : ""}${f.lastBody}` : t("Si hei til {name}", { name: f.name.split(" ")[0] })}
                    </p>
                  </div>
                  {f.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sea px-1.5 text-[11px] font-semibold text-white">
                      {f.unread > 9 ? "9+" : f.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
