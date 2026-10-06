import type { Metadata } from "next";
import Link from "next/link";
import ProsePage from "@/components/ProsePage";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Retningslinjer for innhold"),
    description: t("Hva som er lov å dele og skrive på Vis, og hva som skjer hvis noen bryter reglene."),
  };
}

export default async function GuidelinesPage() {
  return (await getLocale()) === "en" ? <GuidelinesEn /> : <GuidelinesNb />;
}

function GuidelinesNb() {
  return (
    <ProsePage
      eyebrow="Trygghet"
      title="Retningslinjer for innhold"
      intro="Vis skal være et sted der folk tør å vise frem det de lager, også det som ikke er ferdig. Det krever at vi er ærlige om hva vi har laget, og greie med hverandre."
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

// Oversettelse av retningslinjene. Hold den i takt med GuidelinesNb når teksten endres.
function GuidelinesEn() {
  return (
    <ProsePage
      eyebrow="Safety"
      title="Content guidelines"
      intro="Vis should be a place where people dare to show what they make, even what isn't finished. That requires us to be honest about what we've made, and kind to each other."
      updated="25 September 2026"
    >
      <h2>1. Show your own work</h2>
      <p>
        Share projects you&apos;ve made yourself or contributed to. If you worked in a team, write what your role was, and give
        others credit for their part. It&apos;s fine to share school assignments and side projects – just don&apos;t pass off
        someone else&apos;s work as your own.
      </p>

      <h2>2. Be constructive in the comments</h2>
      <ul>
        <li>Praise is great. Criticism is great too, as long as it&apos;s about the work and not the person.</li>
        <li>No harassment, hate, threats or demeaning comments about anyone&apos;s gender, ethnicity, religion, sexual orientation, disability or age.</li>
        <li>Hate speech is illegal in Norway (Penal Code § 185) and will be removed and reported to the police when needed.</li>
      </ul>

      <h2>3. No spam</h2>
      <p>
        Don&apos;t post ads, link spam or the same comment in many places. Don&apos;t buy, sell or trade followers and reactions.
        Accounts that only exist to promote something will be banned.
      </p>

      <h2>4. Protect privacy – yours and others&apos;</h2>
      <ul>
        <li>Don&apos;t share other people&apos;s personal information (addresses, phone numbers, photos of people) without their consent.</li>
        <li>Remove customer data, passwords and API keys from screenshots, READMEs and CVs before you upload them.</li>
        <li>Think about what you show in your CV. You can hide the CV document and only show what you want.</li>
      </ul>

      <h2>5. Respect copyright</h2>
      <p>
        Only upload images, video and code you have the right to share. If you use other people&apos;s material (icons, fonts,
        images, libraries), follow the licence and give credit where required. If you believe someone has used your work without
        permission, report it.
      </p>

      <h2>6. Illegal and harmful content</h2>
      <p>
        We don&apos;t allow content that is illegal, sexually explicit, glorifies violence, or spreads malware or instructions
        for harming others. Security research and CTF write-ups are welcome, as long as they don&apos;t make it easier to attack
        real systems without permission.
      </p>

      <h2>7. Be yourself</h2>
      <p>Don&apos;t pretend to be another person, company or organisation, and don&apos;t create profiles on behalf of others without permission.</p>

      <h2>How to report</h2>
      <p>
        Tap <strong>⋯</strong> on a project, a comment or a profile and choose <strong>Report</strong>. The person you report
        won&apos;t be told who reported them. A moderator looks at every report, usually within a couple of days.
      </p>

      <h2>What happens when the rules are broken</h2>
      <ul>
        <li>
          <strong>The content is removed.</strong> A removed project is hidden from everyone else, and the owner sees the reason
          on the project page.
        </li>
        <li>
          <strong>The account is banned.</strong> For repeated or serious breaches, we ban the account, for a period or
          permanently. The content of a banned account is hidden.
        </li>
        <li>
          If you believe we&apos;ve made a mistake, get in touch and we&apos;ll take another look. Also read the{" "}
          <Link href="/vilkar">terms</Link> and the <Link href="/personvern">privacy policy</Link>.
        </li>
      </ul>
    </ProsePage>
  );
}
