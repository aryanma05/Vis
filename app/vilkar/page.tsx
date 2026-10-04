import type { Metadata } from "next";
import Link from "next/link";
import ProsePage from "@/components/ProsePage";

export const metadata: Metadata = {
  title: "Vilkår for bruk",
  description: "Vilkårene for å bruke Vis: kontoen din, innholdet ditt og hva vi kan og ikke kan gjøre.",
};

export default function TermsPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <ProsePage
      eyebrow="Juridisk"
      title="Vilkår for bruk"
      intro="Kort fortalt: innholdet ditt er ditt, du er ansvarlig for det du legger ut, og vi gjør vårt beste for at Vis er trygt og tilgjengelig."
      updated="4. oktober 2026"
    >
      <h2>1. Om tjenesten</h2>
      <p>
        Vis er en norsk tjeneste der du kan lage en profil med visittkort, CV og prosjekter, følge andre og gi
        tilbakemeldinger. Vis er et studentprosjekt i utvikling. Funksjoner kan endres, og tjenesten kan tidvis være nede.
      </p>

      <h2>2. Kontoen din</h2>
      <ul>
        <li>Du må være minst 13 år for å lage en konto.</li>
        <li>Opplysningene du oppgir skal være riktige, og du skal bare ha én personlig konto.</li>
        <li>Du er ansvarlig for det som skjer på kontoen din. Hold passordet for deg selv, og si fra hvis noen har fått tilgang.</li>
        <li>
          Du kan slette kontoen når som helst under Konto og personvern. Da slettes profilen, prosjektene, CV-en og kommentarene
          dine, og et Pro-abonnement avsluttes med en gang.
        </li>
      </ul>

      <h2>3. Innholdet ditt</h2>
      <p>
        Du eier det du legger ut. Ved å publisere noe på Vis gir du oss en gratis, ikke-eksklusiv rett til å lagre, vise og
        spre det på Vis (for eksempel i søk, strømmen og forhåndsbilder når noen deler en lenke) så lenge det ligger ute.
        Retten opphører når du sletter innholdet eller kontoen.
      </p>
      <p>Du lover at du har rett til å dele det du laster opp, og at det ikke bryter norsk lov eller andres rettigheter.</p>

      <h2>4. Hva som ikke er lov</h2>
      <p>
        Alt innhold og all oppførsel på Vis skal følge <Link href="/retningslinjer">retningslinjene for innhold</Link>. I
        tillegg er det ikke lov å prøve å bryte deg inn i tjenesten, hente ut data automatisk i stor skala utenom API-et, eller
        bruke Vis til å sende uønsket reklame.
      </p>

      <h2>5. Pro og Bedrift</h2>
      <p>
        Det meste av Vis er gratis. Pro (for personer) og Bedrift (for bedrifter) er abonnementer som betales på forskudd per
        måned eller år, med kort, Apple Pay eller Google Pay gjennom Stripe. Prisene står på <Link href="/priser">priser</Link>.
        Pro-prisen er det du betaler totalt; Bedrift-prisen er oppgitt uten eventuell merverdiavgift.
      </p>
      <ul>
        <li>Abonnementet fornyes automatisk til du sier det opp. Du får kvittering på e-post for hver betaling.</li>
        <li>
          Du kan si opp når som helst under Konto (eller Administrer hos bedriften). Du beholder tilgangen ut perioden du har
          betalt for, og ingenting av det du har lagt ut blir slettet eller skjult når du går tilbake til Gratis.
        </li>
        <li>
          <strong>Angrerett:</strong> kjøper du Pro som privatperson, har du 14 dagers angrerett etter angrerettloven. Angrer du
          innen 14 dager etter første kjøp, får du hele beløpet tilbake
          {contact ? (
            <>
              {" "}– skriv til <a href={`mailto:${contact}`}>{contact}</a>
            </>
          ) : null}
          . Bedrift kjøpes av virksomheter, og der gjelder ikke angreretten.
        </li>
        <li>
          Endrer vi prisen på et abonnement du har, sier vi fra på e-post minst 30 dager før den nye prisen gjelder, så du kan
          si opp før det.
        </li>
        <li>Feiler en betaling, prøver Stripe igjen noen dager. Lykkes det ikke, går kontoen tilbake til Gratis.</li>
      </ul>

      <h2>6. Bedrifter og stillingsannonser</h2>
      <ul>
        <li>Den som lager en bedriftsside, må ha rett til å representere bedriften.</li>
        <li>
          Stillingsannonser skal være ekte, ledige stillinger, og følge likestillings- og diskrimineringsloven. Vi kan fjerne
          annonser som ikke gjør det.
        </li>
        <li>
          Kandidatsøket og kontakt med kandidater skal bare brukes til rekruttering. Det er ikke lov å videreselge eller
          publisere opplysninger om kandidater, eller sende masseutsendelser.
        </li>
      </ul>

      <h2>7. API og innbygging</h2>
      <p>
        Det offentlige innholdet kan hentes gjennom <Link href="/utviklere">API-et</Link> og vises med merker og
        innbyggingskort, innenfor grensene som står der. Vis tydelig at innholdet kommer fra Vis, respekter at folk kan slette
        eller skjule det de har lagt ut, og ikke bruk API-et til å bygge kopier av Vis eller samle inn persondata i stor skala.
        Vi kan stenge nøkler som misbrukes.
      </p>

      <h2>8. Moderering</h2>
      <p>
        Vi kan fjerne innhold og stenge kontoer som bryter vilkårene eller retningslinjene, og vi prøver alltid å forklare
        hvorfor. Du kan be oss vurdere en avgjørelse på nytt.
      </p>

      <h2>9. Ansvar</h2>
      <p>
        Vis leveres «som den er». Vi kan ikke garantere at tjenesten alltid er tilgjengelig eller feilfri, og vi er ikke
        ansvarlige for innhold andre brukere legger ut. Ta gjerne vare på en kopi av det som er viktig for deg – du kan laste
        ned alle dataene dine under Konto og personvern.
      </p>

      <h2>10. Personvern</h2>
      <p>
        Hvordan vi behandler personopplysninger står i <Link href="/personvern">personvernerklæringen</Link>.
      </p>

      <h2>11. Endringer</h2>
      <p>
        Vi kan endre vilkårene. Ved store endringer sier vi fra på Vis før de gjelder. Bruker du tjenesten etter at endringene
        gjelder, godtar du de nye vilkårene.
      </p>

      <h2>12. Lovvalg</h2>
      <p>
        Norsk rett gjelder for vilkårene og bruken av Vis.
        {contact && (
          <>
            {" "}Spørsmål? Skriv til <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        )}
      </p>
    </ProsePage>
  );
}
