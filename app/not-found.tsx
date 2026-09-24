import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="blueprint relative flex min-h-[80vh] items-center justify-center overflow-hidden px-6 py-24 md:pl-24">
      <div className="relative max-w-xl text-center">
        <p className="label-mono">Feil 404</p>
        <h1 className="mt-5 display text-[clamp(3.5rem,12vw,8rem)] text-fg">
          Her var det <span className="serif-accent text-ice">tomt</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-md text-lg leading-8 text-mist">
          Siden finnes ikke, eller lenken er feil. Kanskje profilen har byttet brukernavn?
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Til forsiden</ButtonLink>
          <ButtonLink href="/sok" variant="secondary">
            Utforsk prosjekter
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
