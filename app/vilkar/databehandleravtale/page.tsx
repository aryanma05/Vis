import type { Metadata } from "next";
import Link from "next/link";
import ProsePage from "@/components/ProsePage";
import { COMPANY_TERMS_VERSION } from "@/lib/company-access";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Databehandleravtale"),
    description: t("Avtalen mellom bedriften og Vis om behandling av søknader, kandidatlister og meldinger (GDPR art. 28)."),
  };
}

type Setup = { blob: boolean; emailService: string | null; stripe: boolean; contact?: string };

// Databehandleravtalen bedrifter godtar under «Personvern og logg» (versjonen lagres). Underleverandørene
// leses fra oppsettet på serveren, som i personvernerklæringen, så listen alltid stemmer.
export default async function DataProcessingPage() {
  const setup: Setup = {
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    emailService: process.env.BREVO_API_KEY ? "Brevo" : process.env.RESEND_API_KEY ? "Resend" : null,
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    contact: process.env.CONTACT_EMAIL,
  };
  return (await getLocale()) === "en" ? <DpaEn {...setup} /> : <DpaNb {...setup} />;
}

// Den norske teksten er den som gjelder. Den engelske er en oversettelse (se DpaEn).
function DpaNb({ blob, emailService, stripe, contact }: Setup) {
  return (
    <ProsePage
      eyebrow="Juridisk"
      title="Databehandleravtale"
      intro={`Avtale etter personvernforordningen (GDPR) artikkel 28 nr. 3 mellom bedriften og Vis. Versjon ${COMPANY_TERMS_VERSION}.`}
      updated="8. oktober 2026"
    >
      <h2>1. Parter og formål</h2>
      <p>
        Avtalen gjelder mellom bedriften som har en bedriftsside på Vis (<strong>behandlingsansvarlig</strong>) og Vis
        (<strong>databehandler</strong>). Den godtas av en eier eller administrator under «Personvern og logg», og gjelder for
        hele bedriften. Formålet er at bedriften skal kunne rekruttere gjennom Vis: ta imot og vurdere søknader, finne
        kandidater som selv har valgt å være synlige, lagre dem i lister og kontakte dem.
      </p>

      <h2>2. Opplysninger og registrerte</h2>
      <ul>
        <li>
          <strong>Hvem:</strong> personer som søker på bedriftens stillinger, kandidater bedriften finner i kandidatsøket, og
          medlemmene i bedriften.
        </li>
        <li>
          <strong>Hva:</strong> profil, prosjekter, CV (erfaring, utdanning og ferdigheter), e-postadresse når noen søker,
          søknadsmeldinger, status i søknadsprosessen, notater, vurderingskort, intervjutider, kandidatlister med notater,
          meldinger bedriften sender, og aktivitetsloggen.
        </li>
        <li>
          Vis behandler ikke særlige kategorier av personopplysninger på vegne av bedriften, og bedriften skal ikke registrere
          slike (se <Link href="/vilkar#bedrifter">vilkårene § 6</Link>).
        </li>
      </ul>

      <h2>3. Bare etter instruks</h2>
      <p>
        Vis behandler opplysningene bare etter bedriftens dokumenterte instrukser, slik de kommer til uttrykk i denne avtalen,
        i innstillingene bedriften velger (for eksempel lagringstid og webhooks) og i det bedriften gjør i tjenesten. Vis
        bruker ikke opplysningene til egne formål, selger dem ikke og bruker dem ikke til å trene modeller. Mener Vis at en
        instruks er i strid med personvernreglene, sier vi fra.
      </p>

      <h2>4. Taushetsplikt</h2>
      <p>
        Alle som arbeider for Vis og har tilgang til opplysningene, har taushetsplikt. Tilgang gis bare når det trengs for å
        drifte tjenesten, rette feil eller behandle en rapport.
      </p>

      <h2>5. Sikkerhet</h2>
      <ul>
        <li>Tilgangsstyring med roller (eier, administrator, rekrutterer og vurderer); vurderere ser aldri kontaktinfo.</li>
        <li>Aktivitetslogg over hvem som har åpnet, flyttet, kontaktet og eksportert, som bedriften kan lese og laste ned.</li>
        <li>Bedriften kan kreve tofaktorinnlogging for alle medlemmer.</li>
        <li>All trafikk er kryptert (HTTPS), passord lagres bare som hash, og API-nøkler og koder lagres som hash.</li>
        <li>Grenser for kontakt, eksport og søk per bedrift, og automatisk sletting etter faste datoer.</li>
      </ul>

      <h2 id="underleverandorer">6. Underleverandører</h2>
      <p>Bedriften godkjenner at Vis bruker disse underleverandørene:</p>
      <ul>
        <li>Render (drift av nettsiden) og Neon (database), begge på servere i EU (Frankfurt).</li>
        {blob && <li>Vercel Blob (bilder og CV-filer).</li>}
        {emailService && <li>{emailService} (e-post).</li>}
        {stripe && <li>Stripe (betaling; behandler ikke kandidatdata).</li>}
      </ul>
      <p>
        Vis har avtaler med underleverandørene som gir minst samme beskyttelse som denne avtalen. Vi varsler bedriften før vi
        bytter eller legger til en underleverandør, så bedriften kan protestere.
      </p>

      <h2>7. De registrertes rettigheter</h2>
      <p>
        Vis hjelper bedriften med å svare på krav om innsyn, retting, sletting og protest. Kandidater kan selv laste ned
        dataene sine, fjerne seg fra lister og blokkere bedrifter under «Bedrifter og deg». Vis hjelper også med informasjon
        bedriften trenger til en vurdering av personvernkonsekvenser (DPIA).
      </p>

      <h2>8. Avvik</h2>
      <p>
        Oppdager Vis et brudd på personopplysningssikkerheten som gjelder bedriftens data, varsler vi bedriften uten
        ugrunnet opphold, med mål om under 24 timer, og gir den informasjonen bedriften trenger for å melde fra til
        Datatilsynet og de registrerte.
      </p>

      <h2>9. Lagring og sletting</h2>
      <ul>
        <li>
          Søknader slettes senest 12 måneder etter at de kom inn, og etter bedriftens valgte lagringstid når stillingen er
          lukket. Trukne søknader minimeres med en gang og slettes etter 30 dager.
        </li>
        <li>Kandidatlister slettes etter 12 måneder, kontaktforespørsler og aktivitetsloggen etter 24 måneder.</li>
        <li>Slettes bedriften, slettes opplysningene innen 30 dager, også i sikkerhetskopier.</li>
      </ul>

      <h2>10. Revisjon</h2>
      <p>
        Bedriften kan be om den informasjonen som trengs for å vise at avtalen følges, og kan gjennomføre revisjon, selv eller
        med en uavhengig revisor, med rimelig varsel.
        {contact && (
          <>
            {" "}Skriv til <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        )}
      </p>

      <h2>11. Varighet og endringer</h2>
      <p>
        Avtalen gjelder så lenge bedriften har en bedriftsside på Vis. Ved vesentlige endringer kommer det en ny versjon som
        må godtas på nytt under «Personvern og logg». Norsk rett gjelder. Se også{" "}
        <Link href="/personvern#bedrifter">personvernerklæringen</Link> og <Link href="/vilkar#bedrifter">reglene for bedrifter</Link>.
      </p>
    </ProsePage>
  );
}

// Oversettelse av databehandleravtalen. Hold den i takt med DpaNb når teksten endres.
function DpaEn({ blob, emailService, stripe, contact }: Setup) {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Data processing agreement"
      intro={
        <>
          <p>Agreement under the GDPR Article 28(3) between the company and Vis. Version {COMPANY_TERMS_VERSION}.</p>
          <p className="mt-3 text-base">
            This is an English translation for convenience. If anything differs, the{" "}
            <a href="/sprak?til=nb&tilbake=%2Fvilkar%2Fdatabehandleravtale">Norwegian version</a> applies.
          </p>
        </>
      }
      updated="8 October 2026"
    >
      <h2>1. Parties and purpose</h2>
      <p>
        This agreement is between the company that has a company page on Vis (the <strong>controller</strong>) and Vis (the{" "}
        <strong>processor</strong>). It&apos;s accepted by an owner or administrator under “Privacy and log”, and applies to the
        whole company. The purpose is to let the company recruit through Vis: receive and assess applications, find candidates
        who have chosen to be visible, save them in lists and contact them.
      </p>

      <h2>2. Data and data subjects</h2>
      <ul>
        <li>
          <strong>Who:</strong> people who apply for the company&apos;s jobs, candidates the company finds in candidate search,
          and the company&apos;s members.
        </li>
        <li>
          <strong>What:</strong> profile, projects, CV (experience, education and skills), email address when someone applies,
          application messages, status in the hiring process, notes, scorecards, interview times, candidate lists with notes,
          messages the company sends, and the activity log.
        </li>
        <li>
          Vis doesn&apos;t process special categories of personal data on behalf of the company, and the company must not record
          any (see <Link href="/vilkar#bedrifter">the terms § 6</Link>).
        </li>
      </ul>

      <h2>3. Only on instructions</h2>
      <p>
        Vis only processes the data on the company&apos;s documented instructions, as set out in this agreement, in the settings
        the company chooses (for example retention period and webhooks) and in what the company does in the service. Vis
        doesn&apos;t use the data for its own purposes, doesn&apos;t sell it and doesn&apos;t use it to train models. If Vis believes
        an instruction breaks data protection rules, we&apos;ll say so.
      </p>

      <h2>4. Confidentiality</h2>
      <p>
        Everyone working for Vis who has access to the data is bound by confidentiality. Access is only given when needed to
        run the service, fix errors or handle a report.
      </p>

      <h2>5. Security</h2>
      <ul>
        <li>Role-based access control (owner, administrator, recruiter and reviewer); reviewers never see contact details.</li>
        <li>An activity log of who has opened, moved, contacted and exported, which the company can read and download.</li>
        <li>The company can require two-factor login for all members.</li>
        <li>All traffic is encrypted (HTTPS), passwords are only stored as hashes, and API keys and codes are stored as hashes.</li>
        <li>Limits on contact, export and search per company, and automatic deletion on fixed dates.</li>
      </ul>

      <h2 id="underleverandorer">6. Sub-processors</h2>
      <p>The company approves that Vis uses these sub-processors:</p>
      <ul>
        <li>Render (hosting the website) and Neon (database), both on servers in the EU (Frankfurt).</li>
        {blob && <li>Vercel Blob (images and CV files).</li>}
        {emailService && <li>{emailService} (email).</li>}
        {stripe && <li>Stripe (payment; doesn&apos;t process candidate data).</li>}
      </ul>
      <p>
        Vis has agreements with the sub-processors that give at least the same protection as this agreement. We notify the
        company before we change or add a sub-processor, so the company can object.
      </p>

      <h2>7. Data subjects&apos; rights</h2>
      <p>
        Vis helps the company respond to requests for access, rectification, erasure and objection. Candidates can download
        their own data, remove themselves from lists and block companies under “Companies and you”. Vis also helps with
        information the company needs for a data protection impact assessment (DPIA).
      </p>

      <h2>8. Breaches</h2>
      <p>
        If Vis discovers a personal data breach affecting the company&apos;s data, we notify the company without undue delay,
        aiming for under 24 hours, and provide the information the company needs to notify Datatilsynet and the data subjects.
      </p>

      <h2>9. Storage and deletion</h2>
      <ul>
        <li>
          Applications are deleted no later than 12 months after they came in, and after the company&apos;s chosen retention
          period once the job is closed. Withdrawn applications are minimised right away and deleted after 30 days.
        </li>
        <li>Candidate lists are deleted after 12 months, contact requests and the activity log after 24 months.</li>
        <li>If the company is deleted, the data is deleted within 30 days, including in backups.</li>
      </ul>

      <h2>10. Audits</h2>
      <p>
        The company can ask for the information needed to show that the agreement is followed, and can carry out an audit,
        itself or with an independent auditor, with reasonable notice.
        {contact && (
          <>
            {" "}Write to <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        )}
      </p>

      <h2>11. Duration and changes</h2>
      <p>
        The agreement applies for as long as the company has a company page on Vis. For significant changes there will be a new
        version that must be accepted again under “Privacy and log”. Norwegian law applies. See also the{" "}
        <Link href="/personvern#bedrifter">privacy policy</Link> and the <Link href="/vilkar#bedrifter">rules for companies</Link>.
      </p>
    </ProsePage>
  );
}
