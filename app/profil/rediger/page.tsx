import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getOwnProfile } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import EditNav from "./EditNav";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "Rediger profil – vis" };

export default async function EditProfilePage() {
  const user = await requireUser();
  const profile = await getOwnProfile(user.id);
  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-ink text-white">
      <SiteHeader />
      <EditNav active="profil" username={user.username} />
      <div className="mx-auto max-w-5xl px-6">
        <ProfileForm
          image={profile.image}
          initial={{
            name: profile.name,
            headline: profile.headline ?? "",
            location: profile.location ?? "",
            websiteUrl: profile.websiteUrl ?? "",
            bio: profile.bio ?? "",
            links: profile.links,
          }}
        />
      </div>
    </main>
  );
}
