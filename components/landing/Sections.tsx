import Link from "next/link";
import { ArrowRight, FileText, FolderGit2, IdCard, Sparkles } from "lucide-react";
import Reveal from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";

// Seksjonene på forsiden for besøkende som ikke er logget inn.

export function FeatureTrio() {
  const features = [
    {
      Icon: IdCard,
      title: "Visittkort",
      text: "Navn, tittel, hvor du holder til, hva du er åpen for og lenkene dine. Det første folk ser – og det de husker.",
      art: <CardArt />,
    },
    {
      Icon: FileText,
      title: "CV",
      text: "Last opp PDF-en, så fyller vi ut erfaring, utdanning og ferdigheter. Rett opp, velg mal, og last ned som PDF.",
      art: <CvArt />,
    },
    {
      Icon: FolderGit2,
      title: "Prosjekter",
      text: "Hent fra GitHub, dra inn en mappe eller last opp bilder. README-en blir en fin prosjektside med kommentarer.",
      art: <ProjectsArt />,
    },
  ];
  return (
    <section className="border-t border-line px-5 py-24 md:py-32 md:pl-28 md:pr-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="label-mono">Tre ting, én lenke</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Alt en arbeidsgiver lurer på, <span className="serif-accent font-normal text-ice">før</span> de spør.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {features.map(({ Icon, title, text, art }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface/50 transition hover:border-ice/40">
                <div className="blueprint relative h-56 overflow-hidden border-b border-line bg-ink-2/60">{art}</div>
                <div className="p-6">
                  <p className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                    <Icon className="size-5 text-ice" aria-hidden="true" />
                    {title}
                  </p>
                  <p className="mt-2 leading-7 text-mist">{text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardArt() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-[260px] rotate-[-3deg] rounded-2xl border border-line bg-surface p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] transition duration-700 group-hover:rotate-0">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-full bg-gradient-to-br from-[#ffc27a] to-[#ff8f70]" />
          <div>
            <p className="text-sm font-bold">Jonas Berg</p>
            <p className="text-[11px] text-mist">Fullstack · Trondheim</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">Åpen for jobb</span>
          <span className="rounded bg-ice/10 px-1.5 py-0.5 text-[10px] font-medium text-ice">Frilans</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-line" />
          <div className="h-1.5 w-4/5 rounded-full bg-line" />
        </div>
      </div>
    </div>
  );
}

function CvArt() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="relative h-[180px] w-[140px] rotate-[3deg] rounded-sm bg-white p-3 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] transition duration-700 group-hover:rotate-0">
        <div className="h-2 w-2/3 rounded-full bg-[#071a52]" />
        <div className="mt-1 h-1.5 w-1/2 rounded-full bg-[#94a3b8]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mt-3 space-y-1">
            <div className="h-1.5 w-3/4 rounded-full bg-[#334155]" />
            <div className="h-1 w-full rounded-full bg-[#cbd5e1]" />
            <div className="h-1 w-5/6 rounded-full bg-[#cbd5e1]" />
          </div>
        ))}
      </div>
      <span className="absolute bottom-7 right-8 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg shadow-lg">
        <Sparkles className="size-3 text-ice" aria-hidden="true" /> Fylt ut fra PDF
      </span>
    </div>
  );
}

function ProjectsArt() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative h-40 w-64">
        {[
          "left-0 top-6 rotate-[-8deg] from-[#086788] to-[#0a245e] group-hover:-rotate-12",
          "left-16 top-0 rotate-[2deg] from-[#b9a6ff] to-[#6f8cff] group-hover:-translate-y-2",
          "left-32 top-8 rotate-[9deg] from-[#9fe0a8] to-[#3fb6a8] group-hover:rotate-12",
        ].map((cls) => (
          <div
            key={cls}
            className={`absolute h-28 w-36 rounded-xl border border-white/10 bg-gradient-to-br shadow-[0_24px_40px_-24px_rgb(0_0_0/0.9)] transition duration-700 ${cls}`}
          />
        ))}
        <span className="absolute -bottom-3 left-24 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium shadow-lg">♥ 24 · 💬 6</span>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const steps = [
    { n: "01", title: "Lag profil", text: "To minutter. Velg brukernavn, så har du vis.no/@deg." },
    { n: "02", title: "Importer CV-en", text: "Last opp PDF eller Word. Vi fyller ut erfaring, utdanning og ferdigheter." },
    { n: "03", title: "Vis frem arbeidet", text: "Prosjekter fra GitHub, en mappe eller bilder. Del lenken og få tilbakemeldinger." },
  ];
  return (
    <section className="px-5 py-24 md:py-32 md:pl-28 md:pr-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="label-mono">Slik kommer du i gang</p>
        </Reveal>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} as="li" delay={i * 0.08} className="bg-ink p-8 md:p-10">
              <span className="display block text-7xl text-ice/90 md:text-8xl">{s.n}</span>
              <p className="mt-6 text-xl font-semibold tracking-tight">{s.title}</p>
              <p className="mt-2 leading-7 text-mist">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function TagMarquee({ tags }: { tags: { slug: string; name: string; count: number }[] }) {
  if (tags.length < 4) return null;
  const row = [...tags, ...tags];
  return (
    <section aria-label="Populære teknologier" className="marquee overflow-hidden border-y border-line py-7 md:pl-24">
      <div className="marquee-track flex w-max gap-10 pr-10" style={{ ["--marquee-duration" as string]: `${Math.max(tags.length * 4, 30)}s` }}>
        {row.map((t, i) => (
          <Link
            key={`${t.slug}-${i}`}
            href={`/tag/${t.slug}`}
            aria-hidden={i >= tags.length}
            tabIndex={i >= tags.length ? -1 : undefined}
            className="group flex items-baseline gap-2.5 whitespace-nowrap text-3xl font-bold tracking-tight text-fg/85 transition hover:text-ice md:text-5xl"
          >
            {t.name}
            <span className="font-mono text-xs font-normal text-mist/70">{t.count}</span>
            <span className="ml-8 text-mist/40 group-hover:text-ice" aria-hidden="true">
              ✦
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="px-5 pb-24 md:pb-32 md:pl-28 md:pr-10">
      <Reveal className="blueprint relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-line bg-surface/60 px-6 py-16 text-center md:px-16 md:py-24">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full border border-ice/15" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 size-96 rounded-full border border-ice/10" aria-hidden="true" />
        <h2 className="relative mx-auto max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Klar til å vise hva du <span className="serif-accent font-normal text-ice">kan</span>?
        </h2>
        <p className="relative mx-auto mt-5 max-w-lg text-lg leading-8 text-mist">Gratis, på norsk, og ferdig på et par minutter.</p>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/register" size="lg">
            Lag profilen din <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="/om" size="lg" variant="secondary">
            Les mer om Vis
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  );
}
