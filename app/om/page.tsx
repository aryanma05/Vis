import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import { getPlatformStats } from "@/lib/profiles";

export const metadata: Metadata = {
  title: "Om Vis",
  description: "Vis er et norsk sted for din faglige identitet: visittkort, CV og prosjekter samlet på én lenke.",
};

const PRINCIPLES = [
  {
    title: "Prosjektene først",
    text: "En CV forteller hva du har gjort. Prosjektene viser hvordan. Derfor er bildene store, README-en er en fin side, og alt annet står rundt.",
  },
  {
    title: "Laget for Norden",
    text: "Norsk språk, norske datoer og norsk personvern. Profiler med sted og «åpen for jobb», så det er lett å finne folk i nærheten.",
  },
  {
    title: "For alle som lager digitalt",
    text: "Utviklere, designere, dataforskere, spillutviklere og studenter. Du trenger ikke GitHub for å høre hjemme her.",
  },
  {
    title: "Du eier dataene dine",
    text: "Ingen annonser og ingen sporing. Last ned alt vi har om deg med ett klikk, og slett kontoen når du vil.",
  },
];

export default async function AboutPage() {
  const stats = await getPlatformStats();
  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-16">
      <div className="mx-auto max-w-6xl">
        <p className="label-mono">Om Vis</p>
        <h1 className="mt-5 max-w-5xl display text-[clamp(3rem,8vw,7rem)]">
          GitHub for hele <span className="serif-accent font-normal text-ice">deg</span>.
        </h1>
        <p className="mt-8 max-w-2xl text-xl leading-9 text-fg/80">
          Vis samler den faglige identiteten din på ett sted: et visuelt visittkort, en ryddig CV og prosjektene du har laget.
          Folk kan følge deg, se hva du bygger og gi deg tilbakemeldinger – og du får én lenke å sende til arbeidsgivere.
        </p>

        <dl className="mt-14 grid grid-cols-3 gap-px overflow-hidden rounded-3xl border border-line bg-line">
          {[
            [stats.people, "profiler"],
            [stats.projects, "prosjekter"],
            [stats.tags, "teknologier"],
          ].map(([value, label]) => (
            <div key={label} className="bg-ink p-6 md:p-8">
              <dd className="text-4xl font-bold tracking-tight md:text-6xl">{value}</dd>
              <dt className="mt-1 text-mist">{label}</dt>
            </div>
          ))}
        </dl>

        <section className="mt-24">
          <h2 className="label-mono">Det vi tror på</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05} className="rounded-3xl border border-line p-7">
                <span className="font-mono text-sm text-ice">0{i + 1}</span>
                <h3 className="mt-4 text-2xl font-bold tracking-tight">{p.title}</h3>
                <p className="mt-3 leading-7 text-mist">{p.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mt-24 grid gap-10 border-t border-line pt-14 md:grid-cols-[1fr_1.4fr]">
          <h2 className="text-3xl font-bold tracking-tight">Hvem står bak?</h2>
          <div className="space-y-4 text-lg leading-8 text-fg/80">
            <p>
              Vis er et studentprosjekt fra Oslo, laget av folk som selv har savnet et bedre sted å vise frem det de lager enn
              en PDF og en lenke til et repo.
            </p>
            <p>Vi bygger Vis i det åpne og tar gjerne imot tilbakemeldinger – legg igjen en kommentar på et prosjekt, eller skriv til oss.</p>
          </div>
        </section>

        <div className="mt-20 flex flex-wrap gap-3">
          <ButtonLink href="/register" size="lg">
            Lag profilen din <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="/retningslinjer" size="lg" variant="secondary">
            Les retningslinjene
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
