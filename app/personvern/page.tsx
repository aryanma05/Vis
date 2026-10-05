import type { Metadata } from "next";
import Link from "next/link";
import { analyticsProvider } from "@/components/Analytics";
import ProsePage from "@/components/ProsePage";

export const metadata: Metadata = {
  title: "Personvern",
  description: "Hvilke opplysninger Vis lagrer, hvem som ser dem, og hvordan du laster ned eller sletter dem.",
};

// Teksten tilpasser seg oppsettet på serveren, så den alltid stemmer med hvor dataene
// faktisk havner (bilder i Vercel Blob eller databasen, e-posttjeneste).
export default function PrivacyPage() {
  const blob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const emailService = process.env.BREVO_API_KEY ? "Brevo" : process.env.RESEND_API_KEY ? "Resend" : null;
  const github = Boolean(process.env.GITHUB_CLIENT_ID);
  const google = Boolean(process.env.GOOGLE_CLIENT_ID);
  const contact = process.env.CONTACT_EMAIL;
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const analytics = analyticsProvider();
  const screenshots = process.env.SCREENSHOT_BROWSER_PATH ? null : "Microlink";

  return (
    <ProsePage
      eyebrow="Personvern"
      title="Slik tar vi vare på dataene dine"
      intro="Vis er et studentprosjekt der du kan vise frem prosjektene og CV-en din. Vi lagrer bare det som trengs for at tjenesten skal virke, vi selger ingen opplysninger, og vi har ingen annonser eller sporing på tvers av nettsteder."
      updated="4. oktober 2026"
    >
      <h2>Hva vi lagrer</h2>
      <ul>
        <li>
          <strong>Kontoen din:</strong> navn, e-post, brukernavn og passord. Passordet lagres bare som en kryptografisk hash,
          så ingen (heller ikke vi) kan lese det.
          {(github || google) &&
            ` Logger du inn med ${[github && "GitHub", google && "Google"].filter(Boolean).join(" eller ")}, lagrer vi ID-en fra tjenesten${github ? " og en kryptert tilgangsnøkkel for å hente repoene du velger å importere" : ""}.`}
        </li>
        <li>
          <strong>Det du legger ut:</strong> profiltekst, profilbilde, prosjekter med bilder, CV, kommentarer, reaksjoner og
          hvem du følger.
        </li>
        <li>
          <strong>Innlogging:</strong> når du er logget inn, lagrer vi en økt med IP-adresse og nettlesertype, så du kan holde
          deg innlogget og vi kan stoppe misbruk. Økten utløper når du logger ut, eller etter en uke uten bruk.
        </li>
        <li>
          <strong>Koder på e-post:</strong> sekssifrede koder for å bekrefte e-posten eller lage nytt passord lagres kryptert
          (som hash) og virker i ti minutter.
        </li>
        <li>
          <strong>Visninger:</strong> vi teller hvor mange som ser på en profil eller et prosjekt per dag. Tallene vises bare for
          eieren, under Innsikt, og som et samlet tall på prosjektet.
        </li>
        <li>
          <strong>Hvem har sett profilen:</strong> er du logget inn når du ser på en annen profil, lagrer vi at du har vært der
          (når og hvor mange ganger). Eieren ser hvor mange som har vært innom, og med Pro også hvem. Du kan slå dette av under{" "}
          <Link href="/profil/rediger/konto#personvern">Konto → Personvern</Link>; da lagres ikke besøkene dine, og du ser heller
          ikke selv hvem som har besøkt deg. Besøk slettes etter 13 måneder.
        </li>
        <li>
          <strong>Kontaktmeldinger:</strong> sender du en melding med «Kontakt», lagrer vi meldingen, hvem den er til og hvorfor
          du tar kontakt. Mottakeren får den som varsel og på e-post, og e-postadressen din brukes som svaradresse, så mottakeren
          kan svare deg direkte. Mottakerens e-post deles aldri med deg.
        </li>
        <li>
          <strong>Betaling:</strong>{" "}
          {stripe
            ? "betaler du for Pro eller Bedrift, skjer betalingen hos Stripe. Vi lagrer hvilken plan du har, om den fornyes og en kunde-ID fra Stripe – aldri kortnummeret ditt. Stripe er ansvarlig for kortopplysningene og må oppbevare kvitteringer etter bokføringsreglene."
            : "betaling for Pro og Bedrift er ikke satt opp ennå. Når det kommer, skjer betalingen hos Stripe, og vi lagrer bare hvilken plan du har – aldri kortnummeret ditt."}
        </li>
        <li>
          <strong>Bedrifter:</strong> lager du en bedriftsside, lagrer vi bedriften, stillingene og hvem som er medlem. Vi teller
          visninger og klikk på «Søk på stillingen», men ikke hvem som klikket.
        </li>
        <li>
          <strong>To-trinns innlogging:</strong> slår du det på, lagrer vi nøkkelen til kode-appen og reservekodene dine kryptert.
        </li>
        <li>
          <strong>API-nøkler og webhooks:</strong> lager du en API-nøkkel, lagrer vi navnet på den, starten av nøkkelen og når den
          sist ble brukt. Selve nøkkelen lagres bare som en hash. Webhook-adresser og en logg over de siste leveringene lagres
          hos bedriften de hører til.
        </li>
        <li>
          <strong>Rapporter:</strong> rapporterer du innhold, lagrer vi rapporten, hvem som sendte den og en kopi av det som
          ble rapportert, så moderatorene kan vurdere den. Den som blir rapportert, får ikke vite hvem som sa fra.
        </li>
      </ul>
      <p>
        Når du laster opp et bilde, fjerner vi metadataene i det (EXIF), blant annet GPS-posisjonen til stedet bildet ble
        tatt og hvilket kamera som ble brukt.
      </p>

      <h2>Hvem som ser hva</h2>
      <ul>
        <li>
          <strong>Alle:</strong> navn, brukernavn, profilbilde, profiltekst, publiserte prosjekter, kommentarer, reaksjoner,
          hvem du følger og hvem som følger deg, og CV-en hvis du har gjort den synlig. Det samme kan hentes gjennom det åpne{" "}
          <Link href="/utviklere">API-et</Link> og i innbyggingskortene – aldri mer enn det som står på de offentlige sidene.
        </li>
        <li>
          <strong>Bare du:</strong> e-postadressen, utkast til prosjekter, en skjult CV, varslene dine, private samlinger og
          tallene under Innsikt. E-posten din vises aldri for andre.
        </li>
        <li>
          <strong>Pro-brukere:</strong> ser hvem som har vært innom profilen deres, hvis du var logget inn og ikke har skjult
          deg (se over).
        </li>
        <li>
          <strong>Bedrifter med Bedrift-abonnement:</strong> kan finne deg i kandidatsøket bare hvis du har slått på «Synlig for
          bedrifter» under Rediger profil (det er av som standard). De ser det samme som står på profilen din, og kan legge deg
          i egne kandidatlister med notater og eksportere listene. Slår du det av, forsvinner du fra søket. E-postadressen din
          ser de aldri; tar de kontakt, skjer det gjennom «Kontakt».
        </li>
        <li>
          <strong>Moderatorer:</strong> kan se rapporter og e-postadressen til kontoer når de behandler et brudd på
          retningslinjene.
        </li>
      </ul>

      <h2>E-post</h2>
      <p>
        Vi sender e-post når du skal bekrefte adressen eller lage nytt passord, og varsler om kommentarer, svar, omtaler,
        kontaktmeldinger og en ukentlig oppsummering hvis du har slått det på. Hver ukesoppsummering har en lenke for å melde
        seg av med ett klikk. Du velger selv hvilke varsler du vil ha under{" "}
        <Link href="/profil/rediger/konto#varsler">Konto og varsler</Link>.
      </p>

      <h2>Hvor dataene ligger</h2>
      <ul>
        <li>Nettsiden kjører hos Render, og databasen ligger hos Neon, begge på servere i EU (Frankfurt).</li>
        <li>{blob ? "Bilder og CV-filer lagres hos Vercel Blob." : "Bilder og CV-filer lagres i den samme databasen."}</li>
        {emailService && <li>E-poster sendes gjennom {emailService}.</li>}
        {stripe && <li>Betalinger håndteres av Stripe, som behandler kortopplysningene etter sine egne vilkår.</li>}
        {screenshots && (
          <li>
            Limer du inn en lenke til et prosjekt, sender vi adressen (ikke noe om deg) til {screenshots}, som tar skjermbildene
            av siden.
          </li>
        )}
        {analytics && (
          <li>
            Vi teller besøk med {analytics}, uten informasjonskapsler og uten å lagre IP-adressen din, bare for å se hvilke sider
            som brukes.
          </li>
        )}
        <li>
          Bruker du «fyll ut fra CV-en», leses teksten i filen på vår egen server. CV-en sendes ikke til noen annen tjeneste.
        </li>
      </ul>

      <h2>Hvor lenge vi lagrer</h2>
      <ul>
        <li>Det du har lagt ut, til du sletter det eller kontoen.</li>
        <li>Hvem som har sett en profil: 13 måneder etter siste besøk.</li>
        <li>Feillogg og logg over webhook-leveringer: 30 dager.</li>
        <li>Tellere for å stoppe misbruk (antall forsøk per IP-adresse eller konto): to døgn.</li>
        <li>Innlogging: til du logger ut, eller en uke uten bruk.</li>
      </ul>

      <h2>Informasjonskapsler</h2>
      <p>
        Vi bruker én nødvendig informasjonskapsel for å holde deg innlogget, og én som husker språket hvis du velger engelsk
        eller norsk i bunnteksten. Fargetemaet og hvilke sider du har sett i økten (så visninger ikke telles dobbelt) lagres
        i nettleseren din. Ingen analyse- eller reklamekapsler.{stripe && " Betalingssiden hos Stripe setter sine egne kapsler for å hindre svindel."}
      </p>

      <h2>Dine rettigheter</h2>
      <p>
        Du kan når som helst se, endre og slette det du har lagt ut. Under{" "}
        <Link href="/profil/rediger/konto">Konto og personvern</Link> kan du laste ned alt vi har lagret om deg som en fil, og
        slette kontoen. Da slettes profilen, prosjektene, bildene, CV-en, kommentarene, reaksjonene, følgerne, samlingene,
        meldingene og API-nøklene dine med en gang. Har du et aktivt abonnement, sier du det opp under Konto først. Sikkerhetskopier hos databaseleverandøren slettes automatisk etter kort tid.
      </p>
      <p>
        Mener du at vi behandler opplysningene dine feil, kan du klage til{" "}
        <a href="https://www.datatilsynet.no" target="_blank" rel="noreferrer">
          Datatilsynet
        </a>
        .
        {contact && (
          <>
            {" "}Spørsmål? Skriv til <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        )}
      </p>
    </ProsePage>
  );
}
