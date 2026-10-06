import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, FileText, FolderGit2, Share2, UserPen, Users } from "lucide-react";
import { PersonRow } from "@/components/social/PersonRow";
import { ButtonLink } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { getOnboarding } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import { suggestPeople } from "@/lib/social";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Velkommen"), robots: { index: false } };
}

const ICONS = { profil: UserPen, cv: FileText, prosjekt: FolderGit2, folg: Users, del: Share2 } as const;

export default async function WelcomePage() {
  const user = await requireUser();
  const [steps, people, t] = await Promise.all([getOnboarding(user.id, user.username), suggestPeople(user.id, 4), getT()]);
  const firstName = user.name.split(" ")[0] || user.name;
  const done = steps.filter((s) => s.done).length;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-16">
      <div className="mx-auto max-w-5xl">
        <p className="caption">{t("Profilen er klar")} · vis.no/@{user.username}</p>
        <h1 className="mt-2 display text-[clamp(2.25rem,5vw,3.5rem)]">{t("Velkommen, {name}", { name: firstName })}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-mist">
          {t("Noen få steg, så har du et visittkort, en CV og prosjekter folk kan se. Ta dem i den rekkefølgen du vil, og hopp over det du ikke trenger.")}
        </p>

        <ol className="mt-10 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
          {steps.map((step) => {
            const Icon = ICONS[step.key as keyof typeof ICONS] ?? ArrowRight;
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className="group flex items-center gap-4 px-5 py-4 transition hover:bg-fill"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                      step.done ? "bg-success text-white" : "glass-chip text-fg"
                    }`}
                  >
                    {step.done ? <Check className="size-5" strokeWidth={2.6} /> : <Icon className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${step.done ? "text-mist" : "text-fg"}`}>{t(step.label)}</span>
                    <span className="block text-sm leading-6 text-mist">{t(step.description, step.vars)}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-mist transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-mist">
          <span>{t("{done} av {total} gjort", { done, total: steps.length })}</span>
          <ButtonLink href="/" variant="ghost" size="sm">
            {t("Hopp over, gå til strømmen")} <ArrowRight className="size-4" />
          </ButtonLink>
        </div>

        {people.length > 0 && (
          <section className="mt-14 rounded-[22px] glass-card p-6 md:p-8">
            <h2 className="text-lg font-semibold">{t("Folk du kanskje vil følge")}</h2>
            <p className="mt-1 text-sm text-mist">{t("Nye prosjekter fra dem havner i strømmen din.")}</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {people.map((p) => (
                <PersonRow key={p.id} person={p} viewerId={user.id} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
