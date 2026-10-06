import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FollowList from "@/components/profile/FollowList";
import { getT } from "@/lib/i18n/server";
import { getProfileBase } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getFollowCounts, listFollowers, listFollowing } from "@/lib/social";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [profile, t] = await Promise.all([getProfileBase(decodeURIComponent((await params).username)), getT()]);
  return { title: profile ? t("{name} følger", { name: profile.name }) : t("Fant ikke profilen"), robots: { index: false } };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfileBase(decodeURIComponent(username));
  if (!profile) notFound();
  const viewer = await getCurrentUser();
  const [followers, following, counts] = await Promise.all([
    listFollowers(profile.id, viewer?.id),
    listFollowing(profile.id, viewer?.id),
    getFollowCounts(profile.id),
  ]);
  return (
    <FollowList
      name={profile.name}
      username={profile.username}
      mode="folger"
      followers={followers}
      following={following}
      viewerId={viewer?.id}
      counts={counts}
    />
  );
}
