import type { Metadata } from "next";
import Link from "next/link";
import ProsePage from "@/components/ProsePage";

export const metadata: Metadata = {
  title: "Personvern",
  description: "Hvilke opplysninger Vis lagrer, hvem som ser dem, og hvordan du laster ned eller sletter dem.",
};

// Teksten tilpasser seg oppsettet på serveren, så den alltid stemmer med hvor dataene
// faktisk havner (bilder i Vercel Blob eller databasen, e-posttjeneste, CV-lesing).
export default function PrivacyPage() {
  const blob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const emailService = process.env.BREVO_API_KEY ? "Brevo" : process.env.RESEND_API_KEY ? "Resend" : null;
  const cvReader = Boolean(process.env.ANTHROPIC_API_KEY);
  const github = Boolean(process.env.GITHUB_CLIENT_ID);
  const google = Boolean(process.env.GOOGLE_CLIENT_ID);
  const contact = process.env.CONTACT_EMAIL;

  return (
    <ProsePage
      eyebrow="Personvern"
      title={
        <>
          Slik tar vi vare på <span className="serif-accent font-normal text-ice">dataene dine</span>
        </>
      }
      intro="Vis er et studentprosjekt der du kan vise frem prosjektene og CV-en din. Vi lagrer bare det som trengs for at tjenesten skal virke, vi selger ingenting, og vi har ingen annonser eller sporing."
      updated="25. september 2026"
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
          <strong>Visninger:</strong> vi teller hvor mange som ser på en profil eller et prosjekt per dag – ikke hvem. Tallene
          vises bare for eieren, under Innsikt, og som et samlet tall på prosjektet.
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
          hvem du følger og hvem som følger deg, og CV-en hvis du har gjort den synlig.
        </li>
        <li>
          <strong>Bare du:</strong> e-postadressen, utkast til prosjekter, en skjult CV, varslene dine og tallene under
          Innsikt. E-posten din vises aldri for andre.
        </li>
        <li>
          <strong>Moderatorer:</strong> kan se rapporter og e-postadressen til kontoer når de behandler et brudd på
          retningslinjene.
        </li>
      </ul>

      <h2>E-post</h2>
      <p>
        Vi sender e-post når du skal bekrefte adressen eller lage nytt passord, og varsler om kommentarer, svar og omtaler
        hvis du har slått det på. Du velger selv hvilke varsler du vil ha under{" "}
        <Link href="/profil/rediger/konto#varsler">Konto og varsler</Link>.
      </p>

      <h2>Hvor dataene ligger</h2>
      <ul>
        <li>Nettsiden kjører hos Render, og databasen ligger hos Neon, begge på servere i EU (Frankfurt).</li>
        <li>{blob ? "Bilder og CV-filer lagres hos Vercel Blob." : "Bilder og CV-filer lagres i den samme databasen."}</li>
        {emailService && <li>E-poster sendes gjennom {emailService}.</li>}
        {cvReader && (
          <li>
            Bruker du «fyll ut fra CV-en», sendes CV-filen til Anthropic (Claude) for å hente ut teksten. Det skjer bare når du
            selv ber om det.
          </li>
        )}
      </ul>

      <h2>Informasjonskapsler</h2>
      <p>
        Vi bruker bare én nødvendig informasjonskapsel for å holde deg innlogget. Fargetemaet og hvilke sider du har sett i
        økten (så visninger ikke telles dobbelt) lagres i nettleseren din. Ingen analyse- eller reklamekapsler.
      </p>

      <h2>Dine rettigheter</h2>
      <p>
        Du kan når som helst se, endre og slette det du har lagt ut. Under{" "}
        <Link href="/profil/rediger/konto">Konto og personvern</Link> kan du laste ned alt vi har lagret om deg som en fil, og
        slette kontoen. Da slettes profilen, prosjektene, bildene, CV-en, kommentarene, reaksjonene og følgerne dine med en
        gang. Sikkerhetskopier hos databaseleverandøren slettes automatisk etter kort tid.
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
