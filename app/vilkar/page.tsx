import type { Metadata } from "next";
import Link from "next/link";
import ProsePage from "@/components/ProsePage";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Vilkår for bruk"),
    description: t("Vilkårene for å bruke Vis: kontoen din, innholdet ditt og hva vi kan og ikke kan gjøre."),
  };
}

export default async function TermsPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (await getLocale()) === "en" ? <TermsEn contact={contact} /> : <TermsNb contact={contact} />;
}

// Den norske teksten er den som gjelder. Den engelske er en oversettelse (se TermsEn).
function TermsNb({ contact }: { contact?: string }) {
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

// Oversettelse av vilkårene. Hold den i takt med TermsNb når vilkårene endres.
function TermsEn({ contact }: { contact?: string }) {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms of use"
      intro={
        <>
          <p>In short: your content is yours, you&apos;re responsible for what you post, and we do our best to keep Vis safe and available.</p>
          <p className="mt-3 text-base">
            This is an English translation for convenience. If anything differs, the <a href="/sprak?til=nb&tilbake=%2Fvilkar">Norwegian version</a>{" "}
            applies.
          </p>
        </>
      }
      updated="4 October 2026"
    >
      <h2>1. About the service</h2>
      <p>
        Vis is a Norwegian service where you can create a profile with a business card, CV and projects, follow others and
        give feedback. Vis is a student project under development. Features may change, and the service may occasionally be
        down.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 13 years old to create an account.</li>
        <li>The information you provide must be correct, and you may only have one personal account.</li>
        <li>You&apos;re responsible for what happens on your account. Keep your password to yourself, and tell us if someone has gained access.</li>
        <li>
          You can delete your account at any time under Account and privacy. This deletes your profile, projects, CV and
          comments, and any Pro subscription ends immediately.
        </li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You own what you post. By publishing something on Vis you give us a free, non-exclusive right to store, show and
        distribute it on Vis (for example in search, the feed and previews when someone shares a link) for as long as it&apos;s
        published. The right ends when you delete the content or your account.
      </p>
      <p>You promise that you have the right to share what you upload, and that it doesn&apos;t break Norwegian law or other people&apos;s rights.</p>

      <h2>4. What isn&apos;t allowed</h2>
      <p>
        All content and behaviour on Vis must follow the <Link href="/retningslinjer">content guidelines</Link>. It&apos;s also not
        allowed to try to break into the service, extract data automatically at large scale outside the API, or use Vis to send
        unsolicited advertising.
      </p>

      <h2>5. Pro and Business</h2>
      <p>
        Most of Vis is free. Pro (for individuals) and Business (for companies) are subscriptions paid in advance per month or
        year, by card, Apple Pay or Google Pay through Stripe. Prices are listed on the <Link href="/priser">pricing</Link> page.
        The Pro price is the total you pay; the Business price is stated excluding any VAT.
      </p>
      <ul>
        <li>The subscription renews automatically until you cancel it. You get a receipt by email for every payment.</li>
        <li>
          You can cancel at any time under Account (or Manage for a company). You keep access for the rest of the period you&apos;ve
          paid for, and nothing you&apos;ve posted is deleted or hidden when you go back to Free.
        </li>
        <li>
          <strong>Right of withdrawal:</strong> if you buy Pro as a private individual, you have a 14-day right of withdrawal
          under the Norwegian Right of Withdrawal Act. If you withdraw within 14 days of your first purchase, you get the full
          amount back
          {contact ? (
            <>
              {" "}– write to <a href={`mailto:${contact}`}>{contact}</a>
            </>
          ) : null}
          . Business is bought by organisations, and the right of withdrawal doesn&apos;t apply there.
        </li>
        <li>
          If we change the price of a subscription you have, we&apos;ll tell you by email at least 30 days before the new price
          applies, so you can cancel before then.
        </li>
        <li>If a payment fails, Stripe tries again for a few days. If it doesn&apos;t succeed, the account goes back to Free.</li>
      </ul>

      <h2>6. Companies and job ads</h2>
      <ul>
        <li>Whoever creates a company page must have the right to represent the company.</li>
        <li>
          Job ads must be real, open positions, and follow the Norwegian Equality and Anti-Discrimination Act. We may remove
          ads that don&apos;t.
        </li>
        <li>
          Candidate search and contact with candidates may only be used for recruitment. It&apos;s not allowed to resell or publish
          information about candidates, or to send mass mailings.
        </li>
      </ul>

      <h2>7. API and embedding</h2>
      <p>
        Public content can be fetched through the <Link href="/utviklere">API</Link> and shown with badges and embed cards,
        within the limits stated there. Make it clear that the content comes from Vis, respect that people can delete or hide
        what they&apos;ve posted, and don&apos;t use the API to build copies of Vis or collect personal data at large scale. We may
        revoke keys that are misused.
      </p>

      <h2>8. Moderation</h2>
      <p>
        We may remove content and ban accounts that break the terms or the guidelines, and we always try to explain why. You
        can ask us to review a decision.
      </p>

      <h2>9. Liability</h2>
      <p>
        Vis is provided “as is”. We can&apos;t guarantee that the service is always available or error-free, and we&apos;re not
        responsible for content other users post. Keep a copy of what matters to you – you can download all your data under
        Account and privacy.
      </p>

      <h2>10. Privacy</h2>
      <p>
        How we handle personal data is described in the <Link href="/personvern">privacy policy</Link>.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may change the terms. For major changes, we&apos;ll let you know on Vis before they apply. If you use the service after
        the changes apply, you accept the new terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        Norwegian law applies to the terms and your use of Vis.
        {contact && (
          <>
            {" "}Questions? Write to <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        )}
      </p>
    </ProsePage>
  );
}
