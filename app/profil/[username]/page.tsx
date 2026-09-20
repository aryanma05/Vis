import ProfileView from "@/components/ProfileView";
import { getMockProfile } from "@/lib/mockData";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = getMockProfile(username);

  if (!profile) {
    return <ProfileView user={null} />;
  }

  return <ProfileView user={profile} />;
}