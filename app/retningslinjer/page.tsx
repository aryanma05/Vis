import type { Metadata } from "next";
import Link from "next/link";
import ProsePage from "@/components/ProsePage";

export const metadata: Metadata = {
  title: "Retningslinjer for innhold",
  description: "Hva som er lov å dele og skrive på Vis, og hva som skjer hvis noen bryter reglene.",
};

export default function GuidelinesPage() {
  return (
    <ProsePage
      eyebrow="Trygghet"
      title={
        <>
          Retningslinjer for <span className="serif-accent font-normal text-ice">innhold</span>
        </>
      }
      intro="Vis skal være et sted der folk tør å vise frem det de lager – også det som ikke er ferdig. Det krever at vi er ærlige om hva vi har laget, og greie med hverandre."
      updated="25. september 2026"
    >
      <h2>1. Vis ditt eget arbeid</h2>
      <p>
        Del prosjekter du selv har laget eller bidratt til. Jobbet dere i team, skriv hva som var din rolle, og gi andre
        æren for sin del. Det er lov å dele skoleoppgaver og sideprosjekter – bare ikke utgi andres arbeid som ditt.
      </p>

      <h2>2. Vær konstruktiv i kommentarene</h2>
      <ul>
        <li>Ros er fint. Kritikk er også fint, så lenge den handler om arbeidet og ikke om personen.</li>
        <li>Ingen trakassering, hets, trusler eller nedsettende kommentarer om noens kjønn, etnisitet, religion, legning, funksjonsevne eller alder.</li>
        <li>Hatefulle ytringer er ulovlige i Norge (straffeloven § 185) og blir fjernet og anmeldt ved behov.</li>
      </ul>

      <h2>3. Ingen spam</h2>
      <p>
        Ikke legg ut reklame, lenkespam eller de samme kommentarene mange steder. Ikke kjøp, selg eller bytt følgere og
        reaksjoner. Kontoer som finnes bare for å markedsføre noe, blir stengt.
      </p>

      <h2>4. Pass på personvernet – ditt og andres</h2>
      <ul>
        <li>Ikke del andres personopplysninger (adresser, telefonnumre, bilder av folk) uten at de har sagt ja.</li>
        <li>Fjern kundedata, passord og API-nøkler fra skjermbilder, README-er og CV-er før du laster dem opp.</li>
        <li>Tenk over hva du viser i CV-en. Du kan skjule CV-dokumentet og bare vise det du selv vil.</li>
      </ul>

      <h2>5. Respekter opphavsretten</h2>
      <p>
        Last bare opp bilder, video og kode du har lov til å dele. Bruker du andres materiale (ikoner, fonter, bilder,
        biblioteker), følg lisensen og kreditér der det kreves. Mener du at noen har brukt ditt arbeid uten lov, rapporter
        det.
      </p>

      <h2>6. Ulovlig og skadelig innhold</h2>
      <p>
        Vi tillater ikke innhold som er ulovlig, seksuelt eksplisitt, voldsforherligende, eller som sprer skadevare eller
        oppskrifter på å skade andre. Sikkerhetsforskning og CTF-løsninger er velkomne, så lenge de ikke gjør det lettere å
        angripe ekte systemer uten tillatelse.
      </p>

      <h2>7. Vær deg selv</h2>
      <p>Ikke utgi deg for å være en annen person, bedrift eller organisasjon, og ikke lag profiler på vegne av andre uten lov.</p>

      <h2>Slik rapporterer du</h2>
      <p>
        Trykk på <strong>⋯</strong> ved et prosjekt, en kommentar eller en profil og velg <strong>Rapporter</strong>. Den du
        rapporterer får ikke vite hvem som sa fra. En moderator ser på alle rapporter, som regel innen et par dager.
      </p>

      <h2>Hva som skjer ved brudd</h2>
      <ul>
        <li>
          <strong>Innholdet fjernes.</strong> Et fjernet prosjekt blir skjult for alle andre, og eieren ser begrunnelsen på
          prosjektsiden.
        </li>
        <li>
          <strong>Kontoen stenges.</strong> Ved gjentatte eller grove brudd stenger vi kontoen, i en periode eller for godt.
          Innholdet til en stengt konto skjules.
        </li>
        <li>
          Mener du at vi har gjort en feil, ta kontakt, så ser vi på det på nytt. Les også <Link href="/vilkar">vilkårene</Link> og{" "}
          <Link href="/personvern">personvernerklæringen</Link>.
        </li>
      </ul>
    </ProsePage>
  );
}
