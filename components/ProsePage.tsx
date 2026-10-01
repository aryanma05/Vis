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
        <p className="caption">{eyebrow}</p>
        <h1 className="mt-2 display text-[clamp(2.25rem,5vw,3.25rem)]">{title}</h1>
        {intro && <div className="mt-5 text-lg leading-8 text-mist">{intro}</div>}
        {updated && <p className="mt-4 text-sm text-mist">Sist oppdatert {updated}</p>}
        <div className="prose-vis mt-10 border-t border-line pt-2">{children}</div>
      </article>
    </main>
  );
}
