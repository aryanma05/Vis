import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { syncAchievements } from "@/lib/achievements";
import { getT } from "@/lib/i18n/server";
import { getOwnProfile, getOwnProfileFlags } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import { shownUsername } from "@/lib/username";
import EditNav from "./EditNav";
import ProfileForm from "./ProfileForm";
import UsernameForm from "./UsernameForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Rediger profil"), robots: { index: false } };
}

export default async function EditProfilePage() {
  const user = await requireUser();
  const [profile, flags, achievements] = await Promise.all([getOwnProfile(user.id), getOwnProfileFlags(user.id), syncAchievements(user.id)]);
  if (!profile) notFound();

  return (
    <main className="pb-28 md:pb-16 md:pl-24">
      <EditNav active="profil" username={user.username} />
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <ProfileForm
          image={profile.image}
          username={shownUsername(user)}
          visibleToCompanies={flags.visibleToCompanies}
          achievementTiers={Object.fromEntries(achievements.map((a) => [a.key, a.tier]))}
          initial={{
            name: profile.name,
            headline: profile.headline ?? "",
            location: profile.location ?? "",
            websiteUrl: profile.websiteUrl ?? "",
            bio: profile.bio ?? "",
            readme: profile.readme ?? "",
            lookingFor: profile.lookingFor ?? "",
            openTo: profile.openTo,
            studyProgram: profile.studyProgram ?? "",
            graduationYear: profile.graduationYear ? String(profile.graduationYear) : "",
            accentColor: profile.accentColor,
            links: profile.links,
            customSections: profile.customSections,
            contactEnabled: profile.contactEnabled ?? false,
            banner: profile.banner,
            pet: profile.pet,
          }}
        />
        <div className="lg:max-w-[calc(100%-340px)]">
          <UsernameForm current={shownUsername(user)} />
        </div>
      </div>
    </main>
  );
}
