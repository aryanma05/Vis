import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { EmptyState } from "@/components/ui/misc";
import { getT } from "@/lib/i18n/server";
import { areFriends, getMessages } from "@/lib/messages";
import { getProfileBase } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import Chat from "./Chat";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const [friend, t] = await Promise.all([getProfileBase(decodeURIComponent(username)), getT()]);
  return { title: friend ? friend.name : t("Meldinger"), robots: { index: false } };
}

export default async function ConversationPage({ params }: Props) {
  const user = await requireUser();
  const { username } = await params;
  const [friend, t] = await Promise.all([getProfileBase(decodeURIComponent(username)), getT()]);
  if (!friend || friend.id === user.id) notFound();
  const [friends, messages] = await Promise.all([areFriends(user.id, friend.id), getMessages(user.id, friend.id)]);

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-3xl">
        <Link href="/meldinger" className="inline-flex items-center gap-1.5 text-sm text-mist transition hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Meldinger")}
        </Link>
        <Link href={`/@${friend.username}`} className="mt-5 flex items-center gap-3">
          <Avatar name={friend.name} image={friend.image} size={48} />
          <span className="min-w-0">
            <span className="block truncate text-xl font-semibold tracking-tight text-fg">{friend.name}</span>
            <span className="block truncate text-sm text-mist">@{friend.username}</span>
          </span>
        </Link>

        {friends || messages.length > 0 ? (
          <Chat friendId={friend.id} friendName={friend.name} messages={messages} canSend={friends} />
        ) : (
          <EmptyState className="mt-8" icon={<UserPlus className="size-5" />} title={t("Dere er ikke venner ennå")}>
            {t("Dere må følge hverandre for å sende meldinger.")}
          </EmptyState>
        )}
      </div>
    </main>
  );
}
