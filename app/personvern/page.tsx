import Link from "next/link";

export const metadata = {
  title: "Personvern – vis",
  description: "Hvilke opplysninger Vis lagrer, hvem som ser dem, og hvordan du sletter dem.",
};

// Teksten tilpasser seg oppsettet på serveren, så den alltid stemmer med hvor dataene
// faktisk havner (bilder i Vercel Blob eller databasen, e-posttjeneste, CV-lesing).
export default function PrivacyPage() {
  const blob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const emailService = process.env.BREVO_API_KEY ? "Brevo" : process.env.RESEND_API_KEY ? "Resend" : null;
  const cvReader = Boolean(process.env.ANTHROPIC_API_KEY);
  const github = Boolean(process.env.GITHUB_CLIENT_ID);
  const contact = process.env.CONTACT_EMAIL;

  return (
    <main className="min-h-screen pb-28 md:pb-16 md:pl-28 md:pr-10">
      <article className="mx-auto max-w-3xl px-6 py-14 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-mist [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-mist">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Personvern</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Slik tar vi vare på dataene dine</h1>
        <p>
          Vis er et studentprosjekt der du kan vise frem prosjektene og CV-en din. Vi lagrer bare det som trengs for at
          det skal virke, vi selger ingenting, og vi har ingen annonser eller sporing.
        </p>

        <h2>Hva vi lagrer</h2>
        <ul>
          <li>
            <strong className="text-fg">Kontoen din:</strong> navn, e-post, brukernavn og passord. Passordet lagres
            bare som en kryptografisk hash, så ingen (heller ikke vi) kan lese det.
            {github && " Logger du inn med GitHub, lagrer vi GitHub-ID-en din og en kryptert tilgangsnøkkel for å hente repoene du velger å importere."}
          </li>
          <li>
            <strong className="text-fg">Det du legger ut:</strong> profiltekst, profilbilde, prosjekter med bilder,
            CV og kommentarer.
          </li>
          <li>
            <strong className="text-fg">Innlogging:</strong> når du er logget inn, lagrer vi en økt med IP-adresse og
            nettlesertype, så du kan holde deg innlogget og vi kan stoppe misbruk. Økten utløper når du logger ut, eller
            etter en uke uten bruk.
          </li>
        </ul>
        <p>
          Når du laster opp et bilde, fjerner vi metadataene i det (EXIF), blant annet GPS-posisjonen til stedet bildet
          ble tatt og hvilket kamera som ble brukt.
        </p>

        <h2>Hvem som ser hva</h2>
        <ul>
          <li>
            <strong className="text-fg">Alle:</strong> navn, brukernavn, profilbilde, profiltekst, publiserte prosjekter,
            kommentarer, og CV-en hvis du har gjort den synlig.
          </li>
          <li>
            <strong className="text-fg">Bare du:</strong> e-postadressen, utkast til prosjekter og en skjult CV.
            E-posten din vises aldri for andre.
          </li>
        </ul>

        <h2>Hvor dataene ligger</h2>
        <ul>
          <li>Nettsiden kjører hos Render, og databasen ligger hos Neon, begge på servere i EU (Frankfurt).</li>
          <li>{blob ? "Bilder og CV-filer lagres hos Vercel Blob." : "Bilder og CV-filer lagres i den samme databasen."}</li>
          {emailService && <li>E-poster (bekreftelse og nytt passord) sendes gjennom {emailService}.</li>}
          {cvReader && (
            <li>
              Bruker du «les CV-en automatisk», sendes CV-filen til Anthropic (Claude) for å hente ut teksten. Det skjer
              bare når du selv ber om det.
            </li>
          )}
        </ul>

        <h2>Informasjonskapsler</h2>
        <p>
          Vi bruker bare én nødvendig informasjonskapsel for å holde deg innlogget. Valget av fargetema lagres i
          nettleseren din. Ingen analyse- eller reklamekapsler.
        </p>

        <h2>Dine rettigheter</h2>
        <p>
          Du kan når som helst se, endre og slette det du har lagt ut. Under{" "}
          <Link href="/profil/rediger/konto" className="text-fg underline underline-offset-4">
            Konto og personvern
          </Link>{" "}
          kan du laste ned alt vi har lagret om deg som en fil, og slette kontoen. Da slettes profilen, prosjektene,
          bildene, CV-en og kommentarene dine med en gang. Sikkerhetskopier hos databaseleverandøren slettes automatisk
          etter kort tid.
        </p>
        <p>
          Mener du at vi behandler opplysningene dine feil, kan du klage til{" "}
          <a href="https://www.datatilsynet.no" target="_blank" rel="noreferrer" className="text-fg underline underline-offset-4">
            Datatilsynet
          </a>
          .{contact && (
            <>
              {" "}Spørsmål? Skriv til{" "}
              <a href={`mailto:${contact}`} className="text-fg underline underline-offset-4">
                {contact}
              </a>
              .
            </>
          )}
        </p>
      </article>
    </main>
  );
}
