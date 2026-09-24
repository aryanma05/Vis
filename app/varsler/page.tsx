import Link from "next/link";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/format";
import { listNotifications } from "@/lib/notifications";
import { requireUser } from "@/lib/session";
import MarkRead from "./MarkRead";

export const metadata = { title: "Varsler – vis" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user.id);
  const hasUnread = notifications.some((n) => n.unread);

  return (
    <main className="min-h-screen pb-28 md:pb-16 md:pl-28 md:pr-10">
      <MarkRead hasUnread={hasUnread} />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Innboks</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Varsler</h1>

        {notifications.length === 0 ? (
          <p className="mt-12 text-mist">Ingen varsler ennå. Når noen kommenterer prosjektene dine, dukker det opp her.</p>
        ) : (
          <ul className="mt-10 divide-y divide-line border-y border-line">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.project ? `/prosjekt/${n.project.id}#kommentarer` : `/@${n.actor.username}`}
                  className="flex gap-4 px-2 py-5 transition hover:bg-white/[0.03]"
                >
                  <Avatar name={n.actor.name} image={n.actor.image} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium text-fg">{n.actor.name}</span>
                      <span className="text-mist"> kommenterte på </span>
                      <span className="font-medium text-fg">{n.project?.title ?? "et prosjekt"}</span>
                    </p>
                    {n.excerpt && <p className="mt-1 line-clamp-2 text-sm text-mist">«{n.excerpt}»</p>}
                    <p className="mt-1.5 text-xs text-mist/60">{timeAgo(n.createdAt)}</p>
                  </div>
                  {n.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Ulest" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
