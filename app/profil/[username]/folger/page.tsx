import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FollowList from "@/components/profile/FollowList";
import { getProfileBase } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getFollowCounts, listFollowing } from "@/lib/social";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfileBase(decodeURIComponent((await params).username));
  return { title: profile ? `${profile.name} følger` : "Fant ikke profilen", robots: { index: false } };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfileBase(decodeURIComponent(username));
  if (!profile) notFound();
  const viewer = await getCurrentUser();
  const [people, counts] = await Promise.all([listFollowing(profile.id, viewer?.id), getFollowCounts(profile.id)]);
  return <FollowList name={profile.name} username={profile.username} mode="folger" people={people} viewerId={viewer?.id} counts={counts} />;
}
