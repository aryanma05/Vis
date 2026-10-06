import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { getPlatformStats } from "@/lib/profiles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Om Vis"),
    description: t("Vis er et norsk sted for å vise frem det du lager: prosjektene dine, historien bak dem og én lenke å dele."),
  };
}

const PRINCIPLES = [
  {
    title: "Prosjektene først",
    text: "Det du har laget sier mer enn en liste over hva du kan. Derfor er bildene store, beskrivelsen blir en fin side, og alt annet står rundt.",
  },
  {
    title: "Laget for Norden",
    text: "Norsk språk, norske datoer og norsk personvern. Profiler med sted og hva du er åpen for, så det er lett å finne folk å lage ting med i nærheten.",
  },
  {
    title: "For alle som lager digitalt",
    text: "Utviklere, designere, dataforskere, spillutviklere og studenter. Kode, skisser, prototyper og hobbyprosjekter hører hjemme her.",
  },
  {
    title: "Du eier dataene dine",
    text: "Ingen annonser og ingen sporing. Last ned alt vi har om deg med ett klikk, og slett kontoen når du vil.",
  },
];

export default async function AboutPage() {
  const [stats, t] = await Promise.all([getPlatformStats(), getT()]);
  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-16">
      <div className="mx-auto max-w-6xl">
        <p className="caption">{t("Om Vis")}</p>
        <h1 className="mt-2 max-w-4xl display text-[clamp(2.5rem,6vw,4.5rem)]">{t("Et hjem for alt du lager.")}</h1>
        <p className="mt-6 max-w-2xl text-xl leading-9 text-mist">
          {t("Vis er stedet for prosjektene dine: bildene, videoene og historien bak det du har laget, samlet i én profil. Folk kan følge deg, se hva du bygger og gi deg tilbakemeldinger, og du får én lenke å dele med hvem du vil.")}
        </p>

        <dl className="mt-12 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-[22px] glass-card">
          {[
            [stats.people, t("profiler")],
            [stats.projects, t("prosjekter")],
            [stats.tags, t("teknologier")],
          ].map(([value, label]) => (
            <div key={label} className="p-5 md:p-7">
              <dd className="text-3xl font-bold tracking-[-0.03em] tabular-nums md:text-5xl">{value}</dd>
              <dt className="mt-1 text-mist">{label}</dt>
            </div>
          ))}
        </dl>

        <section className="mt-20">
          <h2 className="text-2xl font-bold tracking-[-0.025em]">{t("Det vi tror på")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-[22px] glass-card p-6">
                <h3 className="text-lg font-semibold">{t(p.title)}</h3>
                <p className="mt-2 leading-7 text-mist">{t(p.text)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-[1fr_1.4fr] md:gap-10">
          <h2 className="text-2xl font-bold tracking-[-0.025em]">{t("Hvem står bak?")}</h2>
          <div className="space-y-4 text-lg leading-8 text-mist">
            <p>
              {t("Vis er et studentprosjekt fra Oslo, laget av folk som selv har savnet et bedre sted å vise frem det de lager enn en PDF og en lenke til et repo.")}
            </p>
            <p>{t("Vi bygger Vis i det åpne og tar gjerne imot tilbakemeldinger. Legg igjen en kommentar på et prosjekt, eller skriv til oss.")}</p>
          </div>
        </section>

        <div className="mt-16 flex flex-wrap gap-3">
          <ButtonLink href="/register" size="lg">
            {t("Lag profilen din")} <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="/retningslinjer" size="lg" variant="secondary">
            {t("Les retningslinjene")}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
