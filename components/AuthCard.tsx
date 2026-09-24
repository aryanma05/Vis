import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Logo";

// Ramme for innlogging, registrering og sidene rundt kontoen: skjemaet til venstre
// og et visuelt panel til høyre på store skjermer.
export default function AuthCard({
  title,
  subtitle,
  children,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <main className="px-4 pb-28 pt-8 md:py-10 md:pl-28 md:pr-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[28px] border border-line bg-surface/40 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="flex flex-col px-6 py-10 sm:px-12 md:py-14">
          <Link href="/" className="inline-flex w-fit items-center text-sm text-mist transition hover:text-fg">
            <Wordmark className="text-2xl" />
          </Link>
          <div className="group mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            {/* Tittelen skjules mens man skriver inn koden fra e-posten (components/auth/VerifyEmailCode.tsx). */}
            <div className="mb-8 group-has-[[data-verify-step]]:hidden">
              <h1 className="text-3xl font-bold tracking-tight md:text-[2.5rem] md:leading-[1.05]">{title}</h1>
              {subtitle && <p className="mt-3 leading-7 text-mist">{subtitle}</p>}
            </div>
            <div>{children}</div>
          </div>
          <p className="text-center text-xs text-mist/70">
            <Link href="/personvern" className="hover:text-fg">
              Personvern
            </Link>
            <span className="mx-2">·</span>
            <Link href="/vilkar" className="hover:text-fg">
              Vilkår
            </Link>
            <span className="mx-2">·</span>
            <Link href="/retningslinjer" className="hover:text-fg">
              Retningslinjer
            </Link>
          </p>
        </section>
        <aside className="relative hidden overflow-hidden border-l border-line bg-ink-2 lg:block">{aside ?? <AuthArt />}</aside>
      </div>
    </main>
  );
}

// Standard illustrasjon: et visittkort og noen prosjektkort i Vis-stil.
export function AuthArt({ quote }: { quote?: ReactNode }) {
  return (
    <div className="blueprint absolute inset-0 flex flex-col justify-between p-12">
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full border border-ice/15" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-8 -top-8 size-64 rounded-full border border-ice/10" aria-hidden="true" />
      <p className="label-mono relative">vis.no/@deg</p>

      <div className="relative mx-auto w-full max-w-sm">
        <div className="absolute -left-10 top-10 h-40 w-56 rotate-[-8deg] rounded-2xl border border-line bg-gradient-to-br from-[#0e4d64] to-[#071a52] opacity-70" />
        <div className="absolute -right-8 top-20 h-44 w-52 rotate-[7deg] rounded-2xl border border-line bg-gradient-to-br from-[#2e5f6b] to-[#0a245e] opacity-80" />
        <div className="relative rounded-3xl border border-line bg-surface p-6 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#c7f9ff] to-[#5eb8d4] text-lg font-bold text-[#071a52]">
              IS
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight">Ingrid Solberg</p>
              <p className="text-sm text-mist">Produktdesigner · Bergen</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {["Figma", "React", "Design systems"].map((t) => (
              <span key={t} className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-mist">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {["from-[#086788] to-[#0a245e]", "from-[#b9a6ff] to-[#6f8cff]", "from-[#9fe0a8] to-[#3fb6a8]"].map((g) => (
              <div key={g} className={`aspect-[4/3] rounded-lg bg-gradient-to-br ${g}`} />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
            <span className="text-mist">
              <span className="font-semibold text-fg">12</span> prosjekter
            </span>
            <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">Åpen for jobb</span>
          </div>
        </div>
      </div>

      <p className="relative max-w-sm text-2xl font-semibold leading-snug tracking-tight">
        {quote ?? (
          <>
            Visittkort, CV og prosjekter. <span className="serif-accent text-ice">Ett sted</span> å peke folk til.
          </>
        )}
      </p>
    </div>
  );
}
