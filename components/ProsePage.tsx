import type { ReactNode } from "react";

// Ramme for tekstsider (personvern, vilkår, retningslinjer, om).
export default function ProsePage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-16">
      <article className="mx-auto max-w-3xl">
        <p className="label-mono">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">{title}</h1>
        {intro && <div className="mt-6 text-xl leading-8 text-fg/80">{intro}</div>}
        {updated && <p className="mt-4 text-sm text-mist">Sist oppdatert {updated}</p>}
        <div className="prose-vis mt-12 border-t border-line pt-4">{children}</div>
      </article>
    </main>
  );
}
