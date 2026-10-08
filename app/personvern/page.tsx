import type { Metadata } from "next";
import Link from "next/link";
import { analyticsProvider } from "@/components/Analytics";
import ProsePage from "@/components/ProsePage";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Personvern"),
    description: t("Hvilke opplysninger Vis lagrer, hvem som ser dem, og hvordan du laster ned eller sletter dem."),
  };
}

type Setup = {
  blob: boolean;
  emailService: string | null;
  github: boolean;
  google: boolean;
  contact?: string;
  stripe: boolean;
  analytics: string | null;
  screenshots: string | null;
};

// Teksten tilpasser seg oppsettet på serveren, så den alltid stemmer med hvor dataene
// faktisk havner (bilder i Vercel Blob eller databasen, e-posttjeneste).
export default async function PrivacyPage() {
  const setup: Setup = {
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    emailService: process.env.BREVO_API_KEY ? "Brevo" : process.env.RESEND_API_KEY ? "Resend" : null,
    github: Boolean(process.env.GITHUB_CLIENT_ID),
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    contact: process.env.CONTACT_EMAIL,
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    analytics: analyticsProvider(),
    screenshots: process.env.SCREENSHOT_BROWSER_PATH ? null : "Microlink",
  };
  return (await getLocale()) === "en" ? <PrivacyEn {...setup} /> : <PrivacyNb {...setup} />;
}

// Den norske teksten er den som gjelder. Den engelske er en oversettelse (se PrivacyEn).
function PrivacyNb({ blob, emailService, github, google, contact, stripe, analytics, screenshots }: Setup) {
  return (
    <ProsePage
      eyebrow="Personvern"
      title="Slik tar vi vare på dataene dine"
      intro="Vis er et studentprosjekt der du kan vise frem prosjektene og CV-en din. Vi lagrer bare det som trengs for at tjenesten skal virke, vi selger ingen opplysninger, og vi har ingen annonser eller sporing på tvers av nettsteder."
      updated="8. oktober 2026"
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
          <strong>Bedrifter:</strong> lager du en bedriftsside, lagrer vi bedriften, stillingene, utfordringene og hvem som er medlem
          eller står i teamet. Vi teller visninger og klikk på «Søk på stillingen», men ikke hvem som klikket.
        </li>
        <li>
          <strong>Søknader med Vis-profilen:</strong> søker du på en stilling med profilen din, lagrer vi søknaden: stillingen,
          meldingen din, prosjektene du valgte og statusen bedriften setter (ny, intervju, tilbud eller avslag). Bedriften er
          ansvarlig for søknaden; se <a href="#bedrifter">Søknader, kandidatsøk og bedrifter</a>. Du kan trekke søknaden når som
          helst, og den slettes senest 12 måneder etter at du søkte.
        </li>
        <li>
          <strong>Utfordringer:</strong> svarer du på en utfordring fra en bedrift, lagrer vi hvilket prosjekt du svarte med og en
          eventuell kommentar. Svaret vises offentlig på utfordringen, siden prosjektet ditt allerede er offentlig.
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
          i egne kandidatlister med notater og eksportere listene. Da får du beskjed. Slår du det av, forsvinner du fra søket og
          slettes fra alle lister med en gang. E-postadressen din ser de ikke fra kandidatsøket; tar de kontakt, skjer det
          gjennom «Kontakt». Den deles bare når du selv søker på en stilling hos dem.
        </li>
        <li>
          <strong>Moderatorer:</strong> kan se rapporter og e-postadressen til kontoer når de behandler et brudd på
          retningslinjene.
        </li>
      </ul>

      <h2 id="bedrifter">Søknader, kandidatsøk og bedrifter</h2>
      <p>
        Når du søker på en stilling, blir lagret i en kandidatliste eller får en melding fra en bedrift, er det{" "}
        <strong>bedriften som er behandlingsansvarlig</strong> for opplysningene: søknaden, listene, notatene, vurderingene og
        meldingene. Vis er <strong>databehandler</strong> og behandler dem bare på vegne av bedriften, etter en{" "}
        <Link href="/vilkar/databehandleravtale">databehandleravtale</Link> som alle bedrifter må godta før de kan publisere
        stillinger eller bruke kandidatsøket.
      </p>
      <ul>
        <li>
          <strong>Hva bedriften ser:</strong> når du søker, ser bedriften profilen din, prosjektene du velger, meldingen,
          e-postadressen og CV-en (erfaring, utdanning og ferdigheter). De med rollen Vurderer (for eksempel ledere og
          intervjuere) ser ikke e-postadressen din og kan ikke sende deg meldinger.
        </li>
        <li>
          <strong>Notater og vurderinger:</strong> bedriften kan skrive notater og fylle ut vurderingskort om søknaden din. Du
          kan be bedriften om innsyn, og notatene og vurderingene er med når du laster ned dataene dine.
        </li>
        <li>
          <strong>Aktivitetslogg:</strong> bedriften har en logg over hvem i bedriften som har åpnet, flyttet eller eksportert
          opplysninger om deg.
        </li>
        <li>
          <strong>Lagret i en liste:</strong> lagrer en bedrift profilen din i en kandidatliste, får du et varsel («Bedriften
          lagret profilen din»), maks én gang per bedrift per 30 dager.
        </li>
        <li>
          <strong>Bedrifter og deg:</strong> under <Link href="/profil/rediger/konto/bedrifter">Konto → Bedrifter og deg</Link>{" "}
          ser du hvilke bedrifter som har lagret deg, kontaktet deg, fått en søknad fra deg eller åpnet søknaden din. Der kan du
          fjerne deg fra listene deres eller blokkere dem. En blokkert bedrift finner deg aldri i kandidatsøket, kan ikke lagre
          deg i lister eller kontakte deg, og får ikke vite at du har blokkert den.
        </li>
        <li>
          <strong>Kontakt fra bedrifter:</strong> en bedrift kan sende deg én melding per 30 dager, uansett hvem i bedriften
          som sender, og hver bedrift har en grense per dag. Bedrifter som ikke er bekreftet av Vis, er tydelig merket.
        </li>
        <li>
          <strong>Webhooks:</strong> bedrifter kan koble Vis til egne systemer. Navnet ditt, e-postadressen og meldingen sendes
          bare videre hvis bedriften har slått det på, og ingenting sendes når abonnementet deres er avsluttet.
        </li>
        <li>
          <strong>Ingen automatiske avgjørelser:</strong> Vis rangerer eller avviser aldri kandidater automatisk. Det er alltid
          et menneske i bedriften som vurderer søknaden.
        </li>
      </ul>
      <p>Så lenge lagres det:</p>
      <ul>
        <li>
          Søknader: senest 12 måneder etter at du søkte, og tidligere når stillingen lukkes (3, 6 eller 12 måneder etter, valgt
          av bedriften).
        </li>
        <li>
          Trekker du søknaden, slettes meldingen, prosjektvalget, notatene, vurderingene og en eventuell intervjutid med en gang.
          Bedriften ser bare navnet ditt og «Trukket», og søknaden slettes helt etter 30 dager.
        </li>
        <li>Kandidatlister: 12 måneder, og med en gang du slår av «Synlig for bedrifter» eller blokkerer bedriften.</li>
        <li>Kontaktforespørsler: 24 måneder.</li>
        <li>Aktivitetsloggen hos bedriften: 24 måneder.</li>
        <li>Invitasjoner til en bedrift: 90 dager etter at de er besvart eller har utløpt.</li>
      </ul>
      <p>
        Ta gjerne kontakt med bedriften først, siden det er de som er ansvarlige for søknaden. Du kan også alltid klage til{" "}
        <a href="https://www.datatilsynet.no" target="_blank" rel="noreferrer">
          Datatilsynet
        </a>
        .
      </p>

      <h2>E-post</h2>
      <p>
        Vi sender e-post når du skal bekrefte adressen eller lage nytt passord, og varsler om kommentarer, svar, omtaler,
        kontaktmeldinger og en ukentlig oppsummering hvis du har slått det på. Hver ukesoppsummering har en lenke for å melde
        seg av med ett klikk. Du velger selv hvilke varsler du vil ha under{" "}
        <Link href="/profil/rediger/konto#varsler">Konto og varsler</Link>.
      </p>

      <h2 id="underleverandorer">Hvor dataene ligger</h2>
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
        <li>Søknader, kandidatlister, kontaktforespørsler og bedriftenes logg: se <a href="#bedrifter">over</a>.</li>
        <li>Hvem som har sett en profil: 13 måneder etter siste besøk.</li>
        <li>Feillogg og logg over webhook-leveringer: 30 dager.</li>
        <li>Tellere for å stoppe misbruk (antall forsøk per IP-adresse eller konto): to døgn.</li>
        <li>Innlogging: til du logger ut, eller en uke uten bruk.</li>
      </ul>

      <h2>Informasjonskapsler</h2>
      <p>
        Vi bruker én nødvendig informasjonskapsel for å holde deg innlogget, og én som husker språket hvis du bytter språk i
        innstillingene eller bunnteksten. Fargetemaet, visningsvalgene i innstillingene (som redusert bevegelse) og hvilke
        sider du har sett i økten (så visninger ikke telles dobbelt) lagres i nettleseren din. Ingen analyse- eller
        reklamekapsler.{stripe && " Betalingssiden hos Stripe setter sine egne kapsler for å hindre svindel."}
      </p>

      <h2>Dine rettigheter</h2>
      <p>
        Du kan når som helst se, endre og slette det du har lagt ut. Under{" "}
        <Link href="/profil/rediger/konto">Konto og personvern</Link> kan du laste ned alt vi har lagret om deg som en fil (også
        listene bedrifter har lagt deg i, notater og vurderinger på søknadene dine og hva bedriftene har gjort med dataene
        dine), og slette kontoen. Da slettes profilen, prosjektene, bildene, CV-en, kommentarene, reaksjonene, følgerne, samlingene,
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

// Oversettelse av personvernerklæringen. Hold den i takt med PrivacyNb når teksten endres.
function PrivacyEn({ blob, emailService, github, google, contact, stripe, analytics, screenshots }: Setup) {
  return (
    <ProsePage
      eyebrow="Privacy"
      title="How we take care of your data"
      intro={
        <>
          <p>
            Vis is a student project where you can show your projects and your CV. We only store what&apos;s needed for the
            service to work, we don&apos;t sell any information, and we have no ads or cross-site tracking.
          </p>
          <p className="mt-3 text-base">
            This is an English translation for convenience. If anything differs, the{" "}
            <a href="/sprak?til=nb&tilbake=%2Fpersonvern">Norwegian version</a> applies.
          </p>
        </>
      }
      updated="8 October 2026"
    >
      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> name, email, username and password. The password is only stored as a cryptographic
          hash, so no one (not even us) can read it.
          {(github || google) &&
            ` If you log in with ${[github && "GitHub", google && "Google"].filter(Boolean).join(" or ")}, we store the ID from the service${github ? " and an encrypted access token to fetch the repos you choose to import" : ""}.`}
        </li>
        <li>
          <strong>What you post:</strong> profile text, profile photo, projects with images, CV, comments, reactions and who you
          follow.
        </li>
        <li>
          <strong>Login:</strong> when you&apos;re logged in, we store a session with your IP address and browser type, so you
          can stay logged in and we can stop abuse. The session expires when you log out, or after a week without use.
        </li>
        <li>
          <strong>Codes by email:</strong> six-digit codes for confirming your email or creating a new password are stored
          encrypted (as a hash) and work for ten minutes.
        </li>
        <li>
          <strong>Views:</strong> we count how many people view a profile or a project per day. The numbers are only shown to
          the owner, under Insights, and as a total on the project.
        </li>
        <li>
          <strong>Who has viewed the profile:</strong> if you&apos;re logged in when you view another profile, we store that
          you&apos;ve been there (when and how many times). The owner sees how many have visited, and with Pro also who. You can
          turn this off under <Link href="/profil/rediger/konto#personvern">Account → Privacy</Link>; then your visits aren&apos;t
          stored, and you can&apos;t see who has visited you either. Visits are deleted after 13 months.
        </li>
        <li>
          <strong>Contact messages:</strong> if you send a message with “Contact”, we store the message, who it&apos;s for and
          why you&apos;re getting in touch. The recipient gets it as a notification and by email, and your email address is
          used as the reply-to address, so the recipient can reply to you directly. The recipient&apos;s email is never shared
          with you.
        </li>
        <li>
          <strong>Payment:</strong>{" "}
          {stripe
            ? "if you pay for Pro or Business, the payment happens at Stripe. We store which plan you have, whether it renews and a customer ID from Stripe – never your card number. Stripe is responsible for the card details and must keep receipts according to bookkeeping rules."
            : "payment for Pro and Business isn't set up yet. When it is, the payment will happen at Stripe, and we'll only store which plan you have – never your card number."}
        </li>
        <li>
          <strong>Companies:</strong> if you create a company page, we store the company, the jobs, the challenges and who&apos;s a
          member or listed on the team. We count views and clicks on “Apply for the job”, but not who clicked.
        </li>
        <li>
          <strong>Applications with your Vis profile:</strong> if you apply for a job with your profile, we store the
          application: the job, your message, the projects you picked and the status the company sets (new, interview, offer
          or rejected). The company is responsible for the application; see{" "}
          <a href="#bedrifter">Applications, candidate search and companies</a>. You can withdraw the application at any time,
          and it&apos;s deleted no later than 12 months after you applied.
        </li>
        <li>
          <strong>Challenges:</strong> if you answer a challenge from a company, we store which project you answered with and
          any comment. The entry is shown publicly on the challenge, since your project is already public.
        </li>
        <li>
          <strong>Two-step login:</strong> if you turn it on, we store the key for the code app and your backup codes
          encrypted.
        </li>
        <li>
          <strong>API keys and webhooks:</strong> if you create an API key, we store its name, the start of the key and when it
          was last used. The key itself is only stored as a hash. Webhook addresses and a log of the latest deliveries are
          stored with the company they belong to.
        </li>
        <li>
          <strong>Reports:</strong> if you report content, we store the report, who sent it and a copy of what was reported,
          so the moderators can assess it. The person who is reported isn&apos;t told who reported them.
        </li>
      </ul>
      <p>
        When you upload an image, we remove its metadata (EXIF), including the GPS location where the photo was taken and which
        camera was used.
      </p>

      <h2>Who sees what</h2>
      <ul>
        <li>
          <strong>Everyone:</strong> name, username, profile photo, profile text, published projects, comments, reactions, who
          you follow and who follows you, and your CV if you&apos;ve made it visible. The same can be fetched through the open{" "}
          <Link href="/utviklere">API</Link> and in the embed cards – never more than what&apos;s on the public pages.
        </li>
        <li>
          <strong>Only you:</strong> your email address, project drafts, a hidden CV, your notifications, private collections
          and the numbers under Insights. Your email is never shown to others.
        </li>
        <li>
          <strong>Pro users:</strong> see who has visited their profile, if you were logged in and haven&apos;t hidden yourself
          (see above).
        </li>
        <li>
          <strong>Companies with a Business subscription:</strong> can only find you in candidate search if you&apos;ve turned
          on “Visible to companies” under Edit profile (it&apos;s off by default). They see the same as what&apos;s on your
          profile, and can add you to their own candidate lists with notes and export the lists. You&apos;re told when that
          happens. If you turn it off, you disappear from search and are deleted from every list right away. They don&apos;t see
          your email address from candidate search; if they get in touch, it happens through “Contact”. It&apos;s only shared
          when you apply for a job with them yourself.
        </li>
        <li>
          <strong>Moderators:</strong> can see reports and the email address of accounts when they handle a breach of the
          guidelines.
        </li>
      </ul>

      <h2 id="bedrifter">Applications, candidate search and companies</h2>
      <p>
        When you apply for a job, are saved in a candidate list or get a message from a company, <strong>the company is the
        controller</strong> of the data: the application, the lists, the notes, the reviews and the messages. Vis is the{" "}
        <strong>processor</strong> and only processes them on the company&apos;s behalf, under a{" "}
        <Link href="/vilkar/databehandleravtale">data processing agreement</Link> that every company must accept before it can
        publish jobs or use candidate search.
      </p>
      <ul>
        <li>
          <strong>What the company sees:</strong> when you apply, the company sees your profile, the projects you pick, your
          message, your email address and your CV (experience, education and skills). People with the Reviewer role (for
          example managers and interviewers) don&apos;t see your email address and can&apos;t send you messages.
        </li>
        <li>
          <strong>Notes and reviews:</strong> the company can write notes and fill in scorecards about your application. You
          can ask the company for access, and the notes and reviews are included when you download your data.
        </li>
        <li>
          <strong>Activity log:</strong> the company has a log of who in the company has opened, moved or exported data about
          you.
        </li>
        <li>
          <strong>Saved to a list:</strong> if a company saves your profile in a candidate list, you get a notification (“The
          company saved your profile”), at most once per company per 30 days.
        </li>
        <li>
          <strong>Companies and you:</strong> under <Link href="/profil/rediger/konto/bedrifter">Account → Companies and you</Link>{" "}
          you can see which companies have saved you, contacted you, received an application from you or opened your
          application. There you can remove yourself from their lists or block them. A blocked company never finds you in
          candidate search, can&apos;t save you in lists or contact you, and isn&apos;t told that you blocked it.
        </li>
        <li>
          <strong>Contact from companies:</strong> a company can send you one message per 30 days, whoever in the company sends
          it, and each company has a daily limit. Companies that aren&apos;t verified by Vis are clearly marked.
        </li>
        <li>
          <strong>Webhooks:</strong> companies can connect Vis to their own systems. Your name, email address and message are
          only passed on if the company has turned that on, and nothing is sent once their subscription has ended.
        </li>
        <li>
          <strong>No automated decisions:</strong> Vis never ranks or rejects candidates automatically. A person at the company
          always assesses the application.
        </li>
      </ul>
      <p>How long it&apos;s kept:</p>
      <ul>
        <li>
          Applications: no later than 12 months after you applied, and earlier when the job closes (3, 6 or 12 months after,
          chosen by the company).
        </li>
        <li>
          If you withdraw the application, the message, the chosen projects, the notes, the reviews and any interview slot are
          deleted right away. The company only sees your name and “Withdrawn”, and the application is deleted completely after
          30 days.
        </li>
        <li>Candidate lists: 12 months, and right away if you turn off “Visible to companies” or block the company.</li>
        <li>Contact requests: 24 months.</li>
        <li>The company&apos;s activity log: 24 months.</li>
        <li>Invitations to a company: 90 days after they&apos;re answered or expire.</li>
      </ul>
      <p>
        Feel free to contact the company first, since they&apos;re responsible for the application. You can also always
        complain to{" "}
        <a href="https://www.datatilsynet.no/en/" target="_blank" rel="noreferrer">
          Datatilsynet
        </a>
        .
      </p>

      <h2>Email</h2>
      <p>
        We send email when you need to confirm your address or create a new password, and notifications about comments,
        replies, mentions, contact messages and a weekly summary if you&apos;ve turned it on. Every weekly summary has a link
        to unsubscribe with one click. You choose which notifications you want under{" "}
        <Link href="/profil/rediger/konto#varsler">Account and notifications</Link>.
      </p>

      <h2 id="underleverandorer">Where the data is</h2>
      <ul>
        <li>The website runs at Render, and the database is at Neon, both on servers in the EU (Frankfurt).</li>
        <li>{blob ? "Images and CV files are stored at Vercel Blob." : "Images and CV files are stored in the same database."}</li>
        {emailService && <li>Emails are sent through {emailService}.</li>}
        {stripe && <li>Payments are handled by Stripe, which processes card details under its own terms.</li>}
        {screenshots && (
          <li>
            If you paste a link to a project, we send the address (nothing about you) to {screenshots}, which takes the
            screenshots of the page.
          </li>
        )}
        {analytics && (
          <li>
            We count visits with {analytics}, without cookies and without storing your IP address, only to see which pages are
            used.
          </li>
        )}
        <li>
          If you use “fill in from the CV”, the text in the file is read on our own server. The CV isn&apos;t sent to any other
          service.
        </li>
      </ul>

      <h2>How long we store it</h2>
      <ul>
        <li>What you&apos;ve posted, until you delete it or your account.</li>
        <li>Applications, candidate lists, contact requests and the companies&apos; logs: see <a href="#bedrifter">above</a>.</li>
        <li>Who has viewed a profile: 13 months after the last visit.</li>
        <li>Error log and log of webhook deliveries: 30 days.</li>
        <li>Counters for stopping abuse (number of attempts per IP address or account): two days.</li>
        <li>Login: until you log out, or a week without use.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use one necessary cookie to keep you logged in, and one that remembers the language if you switch language in the
        settings or the footer. The colour theme, the display options in the settings (such as reduced motion) and which pages
        you&apos;ve viewed in the session (so views aren&apos;t counted twice) are stored in your browser. No analytics or
        advertising cookies.{stripe && " Stripe's checkout page sets its own cookies to prevent fraud."}
      </p>

      <h2>Your rights</h2>
      <p>
        You can see, change and delete what you&apos;ve posted at any time. Under{" "}
        <Link href="/profil/rediger/konto">Account and privacy</Link> you can download everything we&apos;ve stored about you as
        a file (including the lists companies have put you in, notes and reviews on your applications and what the companies
        have done with your data), and delete your account. This immediately deletes your profile, projects, images, CV, comments, reactions,
        followers, collections, messages and API keys. If you have an active subscription, cancel it under Account first.
        Backups at the database provider are deleted automatically after a short time.
      </p>
      <p>
        If you believe we&apos;re handling your data incorrectly, you can complain to the Norwegian Data Protection Authority,{" "}
        <a href="https://www.datatilsynet.no/en/" target="_blank" rel="noreferrer">
          Datatilsynet
        </a>
        .
        {contact && (
          <>
            {" "}Questions? Write to <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        )}
      </p>
    </ProsePage>
  );
}
