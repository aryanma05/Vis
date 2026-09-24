import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, FileText, FolderGit2, Share2, UserPen, Users } from "lucide-react";
import { PersonRow } from "@/components/social/PersonRow";
import { ButtonLink } from "@/components/ui/button";
import { getOnboarding } from "@/lib/profiles";
import { requireUser } from "@/lib/session";
import { suggestPeople } from "@/lib/social";

export const metadata: Metadata = { title: "Velkommen", robots: { index: false } };

const ICONS = { profil: UserPen, cv: FileText, prosjekt: FolderGit2, folg: Users, del: Share2 } as const;

export default async function WelcomePage() {
  const user = await requireUser();
  const [steps, people] = await Promise.all([getOnboarding(user.id, user.username), suggestPeople(user.id, 4)]);
  const firstName = user.name.split(" ")[0] || user.name;
  const done = steps.filter((s) => s.done).length;

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-16">
      <div className="mx-auto max-w-5xl">
        <p className="label-mono">Profilen er klar · vis.no/@{user.username}</p>
        <h1 className="mt-4 display text-[clamp(2.75rem,7vw,5.5rem)]">
          Velkommen, <span className="serif-accent font-normal text-ice">{firstName}</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-mist">
          Fem små steg, så har du et visittkort, en CV og prosjekter som folk faktisk ser. Du kan ta dem i hvilken rekkefølge
          du vil – og hoppe over det du ikke trenger.
        </p>

        <ol className="mt-12 grid gap-3">
          {steps.map((step, i) => {
            const Icon = ICONS[step.key as keyof typeof ICONS] ?? ArrowRight;
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className={`group flex items-center gap-5 rounded-3xl border p-5 transition md:p-6 ${
                    step.done ? "border-line/60 bg-surface/30" : "border-line bg-surface/60 hover:-translate-y-0.5 hover:border-ice/50 hover:bg-surface"
                  }`}
                >
                  <span className="hidden font-mono text-sm text-mist/60 sm:block">0{i + 1}</span>
                  <span
                    className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border ${
                      step.done ? "border-success/40 bg-success/15 text-success" : "border-line bg-ink-2 text-ice"
                    }`}
                  >
                    {step.done ? <Check className="size-5" strokeWidth={2.6} /> : <Icon className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-lg font-semibold tracking-tight ${step.done ? "text-mist" : "text-fg"}`}>{step.label}</span>
                    <span className="block text-sm leading-6 text-mist">{step.description}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-mist transition group-hover:translate-x-1 group-hover:text-ice" />
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-mist">
          <span>
            {done} av {steps.length} gjort
          </span>
          <ButtonLink href="/" variant="ghost" size="sm">
            Hopp over, gå til strømmen <ArrowRight className="size-4" />
          </ButtonLink>
        </div>

        {people.length > 0 && (
          <section className="mt-16 rounded-3xl border border-line p-6 md:p-8">
            <h2 className="text-xl font-bold tracking-tight">Folk du kanskje vil følge</h2>
            <p className="mt-1 text-sm text-mist">Nye prosjekter fra dem havner i strømmen din.</p>
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
