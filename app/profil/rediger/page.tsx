import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOwnProfile } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import { shownUsername } from "@/lib/username";
import EditNav from "./EditNav";
import ProfileForm from "./ProfileForm";
import UsernameForm from "./UsernameForm";

export const metadata: Metadata = { title: "Rediger profil", robots: { index: false } };

export default async function EditProfilePage() {
  const user = await requireUser();
  const profile = await getOwnProfile(user.id);
  if (!profile) notFound();

  return (
    <main className="pb-28 md:pb-16 md:pl-24">
      <EditNav active="profil" username={user.username} />
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <ProfileForm
          image={profile.image}
          username={shownUsername(user)}
          initial={{
            name: profile.name,
            headline: profile.headline ?? "",
            location: profile.location ?? "",
            websiteUrl: profile.websiteUrl ?? "",
            bio: profile.bio ?? "",
            readme: profile.readme ?? "",
            lookingFor: profile.lookingFor ?? "",
            openTo: profile.openTo,
            accentColor: profile.accentColor,
            links: profile.links,
            customSections: profile.customSections,
          }}
        />
        <div className="lg:max-w-[calc(100%-340px)]">
          <UsernameForm current={shownUsername(user)} />
        </div>
      </div>
    </main>
  );
}
