# vis

A visual portfolio platform for developers, designers and digital creators.

## About

vis brings your CV, projects and digital identity together in one visual profile.

En norsk «GitHub for digitale profiler»: et visuelt visittkort, en strukturert CV og
prosjektene dine på én lenke (`/@brukernavn`), pluss en feed der man oppdager hva andre lager.

### Funksjoner

- **Profil** på `/@brukernavn` med visittkort, README-seksjon, egne seksjoner, aksentfarge,
  «åpen for»-status, prosjekter (festede først), aktivitetskart og følgere.
- **Utseende**: banner med farge, gradient, mønster, ferdige illustrasjoner (SVG) eller eget
  bilde som kan flyttes, og et kjæledyr på profilen (åtte arter, farger, navn og tilbehør)
  som følger musepekeren og hilser når man trykker på det.
- **Prestasjoner** som på GitHub (`lib/achievement-defs.ts`): 18 merker, mange med nivåer
  (×2 bronse, ×3 sølv, ×4 gull). Regnes ut når profilen vises og lagres i `user_achievement`;
  eieren får en feiring når noe nytt er låst opp. Noe tilbehør til kjæledyret låses opp med merker.
- **CV** på `/@brukernavn/cv` i fem maler (klassisk, moderne og kompakt, pluss elegant og
  tydelig med Pro), på norsk eller engelsk, redigerbar med dra-og-slipp, import fra
  PDF/Word (feltene fylles ut automatisk, se under) og eksport som PDF via utskrift.
- **Prosjekter** med markdown-beskrivelse (README-visning), tagger, rolle, dato, lenker,
  video og bilder. Lim inn lenken til prosjektet, så tas det skjermbilder av siden
  automatisk (opptil tre, nedover siden), som kan fjernes, sorteres og beskjæres før
  lagring. Import fra GitHub (brukernavn eller repo-lenke, uten å logge inn med
  GitHub) eller en lokal mappe; har repoet en nettside og README-en ingen bilder, tas
  det skjermbilder av nettsiden. Prosjekter med et GitHub-repo viser stjerner, språk, siste
  commits og bidragsytere, og eieren kan hente README-en på nytt.
- **Oppdag**: nyeste, populære (trending) og «Følger»-feed, søk etter prosjekter og
  personer, tag-sider på `/tag/<navn>`.
- **Sosialt**: følg folk, reaksjoner (Lik/Nyttig/Inspirerende), kommentarer med svar og
  @omtaler, varsler i appen og på e-post (styres på kontosiden).
- **Innsikt** (`/innsikt`): visninger av profil og prosjekter, følgere og reaksjoner.
- **Moderering**: rapporter innhold, og `/admin` for å fjerne/gjenopprette prosjekter,
  slette kommentarer og utestenge brukere. Retningslinjer på `/retningslinjer`.
- **Konto**: e-postbekreftelse og nytt passord med 6-sifret kode, innlogging med
  GitHub/Google, dataeksport og sletting av konto.
- **Norsk og engelsk**: språkvalg i bunnteksten (se «Språk» under).
- **Åpent API og webhooks** for utviklere og bedrifter (`/utviklere`).
- **SEO**: titler og beskrivelser per side, delingsbilder (Open Graph) for forsiden,
  profiler og prosjekter, `sitemap.xml` og `robots.txt`.

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- framer-motion (animasjoner) og lucide-react (ikoner)
- Playwright (`playwright-core`) for skjermbilder når en lokal Chromium er satt opp
- Postgres (Neon på Vercel) + Drizzle ORM
- Better Auth (e-post/passord med 6-sifret kode, GitHub, Google, admin-rolle)
- Bilder og CV-filer i databasen, eller Vercel Blob hvis det er satt opp

## Kjør lokalt

```bash
npm install
cp .env.example .env.local   
npm run db:migrate       
npm run db:seed             
npm run dev
```

### Database lokalt

Enten Postgres installert på maskinen (`brew install postgresql@16`, så `createdb vis`),
med `DATABASE_URL=postgres://localhost:5432/vis`, eller en egen Neon-database/-branch.

### Miljøvariabler

| Variabel | Hva | Påkrevd lokalt |
| --- | --- | --- |
| `DATABASE_URL` | Postgres-tilkobling | Ja |
| `BETTER_AUTH_SECRET` | Tilfeldig hemmelighet, `openssl rand -base64 32` | Ja |
| `BETTER_AUTH_URL` | `http://localhost:3000` lokalt, domenet i produksjon | Ja |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth-app, for innlogging og repo-import | Nei, knappen skjules uten |
| `GITHUB_TOKEN` | Token uten tilganger for offentlige GitHub-data: import fra brukernavn/repo-lenke og repo-info på prosjektsidene. Uten den er grensen 60 kall i timen | Nei, men anbefalt i produksjon |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth-klient, for innlogging | Nei, knappen skjules uten |
| `ADMIN_EMAILS` | Kommaseparerte e-postadresser som blir admin når kontoen lages | Nei |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob. Uten den lagres bilder og CV-er i databasen (`/filer/...`) | Nei |
| `BREVO_API_KEY` eller `RESEND_API_KEY`, og `EMAIL_FROM` | E-post for bekreftelse og nytt passord. Uten dem skrives e-postene til terminalen under utvikling, og i produksjon er e-postbekreftelse av | Nei |
| `CONTACT_EMAIL` | Kontaktadresse som vises på /personvern | Nei |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` og `STRIPE_PRICE_*` | Betaling for Pro og Bedrift. Se «Betaling» under og `.env.example` | Nei, uten dem er betaling av |
| `CRON_SECRET` | Beskytter planlagte jobber (ukesoppsummeringen). Se «Planlagte jobber» under | Nei, men trengs for ukesoppsummeringen |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` eller `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Besøksstatistikk uten informasjonskapsler (Plausible eller Umami). Nevnes automatisk på /personvern | Nei |
| `MICROLINK_API_KEY` | Skjermbilder av prosjektlenker via Microlink. Uten nøkkel: gratis, 50 sider i døgnet | Nei |
| `SCREENSHOT_BROWSER_PATH` | Sti til Chrome/Chromium. Da tas skjermbildene lokalt i stedet for hos Microlink | Nei |

Under utvikling (`npm run dev`) kan du også ta skjermbilder av prosjekter som kjører på
din egen maskin, f.eks. `localhost:5173`. Da brukes Google Chrome på maskinen (eller
`SCREENSHOT_BROWSER_PATH`), siden Microlink ikke når localhost. I produksjon blokkeres
lokale adresser.

GitHub OAuth-app: github.com/settings/developers → New OAuth App.
Callback-URL: `http://localhost:3000/api/auth/callback/github` (lag en egen app for produksjon).

Google: console.cloud.google.com → APIs & Services → Credentials → OAuth client ID (Web).
Redirect-URI: `http://localhost:3000/api/auth/callback/google`.

### Eksempeldata

`npm run db:seed` lager eksempelbrukere med prosjekter, kommentarer, reaksjoner og følgere.
Alle har passordet `passord123`. Logg inn som `ingrid`, eller `aryan` som er admin.

## Endre databasen

1. Endre `db/schema.ts`
2. `npm run db:generate` lager en ny migrering i `db/migrations/`
3. `npm run db:migrate` kjører den
4. Commit både skjemaet og migreringen

`npm run db:studio` åpner et vindu der du kan se og endre dataene.

## Hvor ting ligger

```
db/schema.ts              alle tabellene
lib/auth.ts               innlogging (Better Auth), brukernavn-regler
lib/username.ts           hva som er et gyldig brukernavn, og forslag når det er tatt
lib/auth-errors.ts        norske feilmeldinger for innlogging/registrering
lib/session.ts            getCurrentUser() / requireUser() for sider og actions
lib/projects.ts           prosjekter: lese, opprette, endre, slette, bilder, feed, søk, tagger
lib/github.ts             GitHub-import (repoliste, README → prosjekt)
lib/folder-import.ts      import fra lokal mappe (kjører i nettleseren, koden lastes ikke opp)
lib/screenshots.ts        skjermbilder av prosjektlenker (Microlink eller lokal Chromium)
lib/cv.ts                 strukturert CV: lagring, redigering og import
lib/cv-parser.ts          leser en opplastet CV (PDF/Word) og gir et utkast til feltene
lib/cv-extract.ts         henter tekstlinjene ut av PDF (pdf.js) og Word (mammoth)
lib/cv-text-parser.ts     tolker linjene: seksjoner, datoer, roller, skoler, lenker
lib/cv-document.ts        CV-dokumentet som vises på profilen (PDF-sider som bilder)
lib/pdf-pages.ts          gjør PDF-sider om til bilder i nettleseren (pdf.js)
lib/comments.ts           kommentarer med svar og @omtaler (lib/mentions.ts)
lib/notifications.ts      varsler i appen og på e-post, og innstillingene for dem
lib/profiles.ts           profilsider, personsøk, fremhevede profiler
lib/social.ts             følge/slutte å følge, følgerlister, forslag til folk
lib/reactions.ts          reaksjoner på prosjekter
lib/views.ts              visningstall for profiler og prosjekter (roboter telles ikke)
lib/insights.ts           tallene på /innsikt
lib/activity.ts           aktivitetskartet på profilen
lib/cv-view.ts            data til CV-malene
lib/admin.ts, reports.ts  moderering: rapporter, fjerne innhold, utestenge brukere
lib/og.tsx                felles oppsett for delingsbildene (opengraph-image.tsx)
lib/site.ts               adressen appen kjører på, og lenker til profiler/prosjekter
lib/constants.ts          lister som deles av server og nettleser (reaksjoner, aksentfarger …)
lib/log.ts                logging (JSON-linjer i produksjon); instrumentation.ts logger serverfeil
lib/storage.ts            filopplasting (Vercel Blob / databasen), krymper bilder og fjerner EXIF/GPS
lib/prepare-image.ts      krymper bilder i nettleseren før opplasting
lib/mailer.ts             e-post (Brevo/Resend) og innholdet i e-postene
lib/account.ts            kontosiden: dataeksport og sletting av filer
lib/billing.ts, stripe.ts abonnementer (Pro og Bedrift) og Stripe-klienten
lib/companies.ts, jobs.ts bedriftssider og stillinger; lib/talent.ts er kandidatsøket
lib/api.ts, api-v1.ts     det åpne API-et; lib/api-keys.ts er nøklene
lib/webhooks.ts           webhooks for bedrifter (signerte leveringer)
lib/i18n/                 språk: t(), getLocale() og den engelske ordboka (en.ts)
lib/rate-limit.ts         grenser per bruker/IP, lagret i databasen
lib/safe-path.ts          sjekker at ?neste=… bare sender til interne sider
app/filer/[...key]        serverer filer lagret i databasen (skjult CV bare for eieren)
app/actions/*.ts          Server Actions som skjemaene kaller
components/ui/            knapper, felt, dialoger, menyer, faner, toasts, brytere
components/               ProjectCard, ProjectCover, ImageEditor (beskjæring), kommentarer osv.
```

## Drift og lansering

- **Sjekkliste:** `/admin?fane=system` viser hvilke miljøvariabler som mangler før lansering
  (verdiene vises aldri), og serveren skriver det samme i loggen når den starter (`lib/env.ts`).
- **Feillogg:** feil fra serveren, Server Actions og nettleseren lagres i `error_event` og
  vises gruppert under System. Eldre enn 30 dager slettes automatisk.
- **Nøkkeltall:** `/admin?fane=nokkeltall` viser nye brukere per uke, aktivering (andel nye
  som publiserer et prosjekt), aktive brukere og om folk kommer tilbake (`lib/metrics.ts`).
- **Begrensninger:** `lib/rate-limit.ts` teller i databasen (`rate_bucket`), så grensene
  gjelder på tvers av serverprosesser og omstarter. Grensene står samlet i `RULES`.
- **Tester og CI:** `npm test` kjører testene i `tests/` (de som trenger database bruker
  `DATABASE_URL` fra `.env.local`). `.github/workflows/ci.yml` kjører lint, typesjekk, tester
  mot en ekte Postgres og bygg på hver push og pull request.

## Vekst og deling

- **Del-menyen** (`components/social/ShareMenu.tsx`): kopier lenke, LinkedIn, X, e-post,
  QR-kode, merke til GitHub-README (`/api/merke/<brukernavn>`, SVG) og kode for å bygge inn
  profilen eller et prosjekt på en annen nettside (`/bygg-inn/profil/<brukernavn>` og
  `/bygg-inn/prosjekt/<id>`, egne sikkerhetshodere i `lib/embed.ts`; `?tema=lys` for lyst).
- **Utvalgt:** admin velger ut prosjekter fra «…»-menyen på prosjektet. De vises først på
  forsiden og i Utforsk (filteret «Utvalgt»), og eieren får varsel og e-post.
- **Kontakt meg:** slås på under Rediger profil. Innloggede kan sende en melding (maks fem
  i døgnet, én per uke til samme person). Mottakeren får varsel og e-post med avsenderens
  adresse som svaradresse; mottakerens e-post deles aldri.
- **Samlinger:** bokmerket på et prosjekt lagrer det i private eller offentlige samlinger
  (`/samlinger`, `/samling/<id>`, og fanen Samlinger på profilen).
- **Oppdateringer:** eieren kan skrive korte oppdateringer på prosjektsiden («Versjon 2 er ute»).
- **To-trinns innlogging** med app for engangskoder og reservekoder (Better Auth
  `twoFactor`), under Konto og varsler.
- **Søk:** filtre for fagfelt, periode og utvalgte prosjekter.
- **Lim inn en lenke:** tittel og beskrivelse hentes fra siden sammen med skjermbildene
  (Dribbble, Behance, Figma og vanlige nettsider), og fylles inn hvis feltene er tomme.

### Planlagte jobber

`/api/cron/ukesoppsummering` sender ukesoppsummeringen (hvem som har sett profilen, nye
følgere, nytt fra folk man følger og utvalgte prosjekter). Kall den med
`Authorization: Bearer <CRON_SECRET>`, f.eks. med en Cron Job hos Render
(`curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domenet>/api/cron/ukesoppsummering`)
eller gratis hos cron-job.org, hver time mandag kl. 07–10. Hver kjøring tar en porsjon på
200; ingen får to på under seks dager. E-posten har ett-klikks avmelding (List-Unsubscribe).

## Betaling, Pro og Bedrift

Vis er gratis. **Pro** (for personer) og **Bedrift** (for bedrifter) betales med Stripe.

| | Gratis | Pro | Bedrift |
| --- | --- | --- | --- |
| Profil, prosjekter, CV, deling | ✓ | ✓ | |
| Hvem har sett profilen | antall | navn og tittel | |
| Innsikt | 30 dager | 90 dager og 12 måneder | |
| CV-maler | 3 | + Elegant og Tydelig | |
| Eget domene, uten «Laget med Vis» | | ✓ | |
| Bedriftsside og stillinger | én aktiv stilling | | ubegrenset |
| Kandidatsøk, lister, CSV, kontakt | | | ✓ |

- `lib/stripe.ts` er en liten klient over Stripe sitt REST-API (ingen ekstra pakke), med
  sjekk av webhook-signaturer. `lib/billing.ts` lager Checkout-sider og kundeportal,
  synkroniserer abonnementer og svarer på «hvilken plan har denne personen/bedriften?».
- **Webhook:** `/api/stripe/webhook`. Hver hendelse behandles én gang (`stripe_event`), og
  abonnementet hentes ferskt fra Stripe, så hendelser i feil rekkefølge ikke gjør noe galt.
  Etter betaling henter `/betaling/takk` abonnementet med en gang, så brukeren slipper å vente.
- **Oppsett:** se Stripe-delen i `.env.example`. Prisene på `/priser` hentes fra Stripe (en
  time i mellomlager); før det er satt opp vises 59 kr/mnd, 590 kr/år og 1 490 kr/mnd.
- **Admin** kan gi Pro eller Bedrift uten betaling (ambassadører, skoler) under Brukere og
  Bedrifter, bekrefte bedrifter, og se inntekt (MRR) under Nøkkeltall.
- **Hvem har sett profilen:** lagres bare for innloggede besøkende som ikke har skjult seg
  (Konto → Personvern). Den som skjuler seg, ser heller ikke selv hvem som har besøkt dem.
- **Synlig for bedrifter:** av som standard. Bare de som slår det på (Rediger profil) finnes
  i kandidatsøket, og bedrifter ser aldri e-postadressen.

### Eget domene (Pro)

Brukeren legger inn domenet under Konto → Pro-innstillinger og får en TXT-post
(`_vis.<domene>`) og en CNAME til appens adresse. Når TXT-posten er funnet, er domenet
bekreftet. `proxy.ts` viser da profilen på `<domene>/` og CV-en på `<domene>/cv`; alt annet
sendes til hovedsiden. **Manuelt steg:** legg domenet til under Settings → Custom Domains hos
Render, så lages HTTPS-sertifikatet (Render har også et API for dette hvis det blir mange).

## API og webhooks

Dokumentasjonen for brukerne ligger på `/utviklere`.

- **API** (`/api/v1/…`, `lib/api-v1.ts`): profiler, prosjekter, stillinger og bedrifter som
  JSON, bare det som allerede er offentlig (aldri e-post, utkast eller skjulte prosjekter).
  Åpent for CORS. `lib/api.ts` (`withApi`) står for grenser, feilsvar og mellomlagring.
- **Nøkler** (`lib/api-keys.ts`): lages under Konto → Utviklere. Bare en SHA-256-hash lagres;
  selve nøkkelen vises én gang. Uten nøkkel 120 kall/min per IP, med nøkkel 1 200/min
  (`RULES.api` og `RULES.apiKey` i `lib/rate-limit.ts`).
- **Webhooks** (`lib/webhooks.ts`, krever Bedrift): `job.published`, `job.closed` og
  `job.application_click` sendes som signert POST (`Vis-Signature`, HMAC-SHA256 som hos
  Stripe) etter at svaret til brukeren er sendt (`after()` i `lib/jobs.ts`). Tre forsøk,
  ingen omdirigeringer, bare https og offentlige adresser (localhost er lov i utvikling).
  De siste leveringene vises under Administrer → Utviklere hos bedriften.

## Språk

Norsk er grunnspråket, og engelsk kan velges i bunnteksten (`/sprak?til=en`, lagres i
informasjonskapselen `vis-sprak`). Uten valg brukes engelsk bare når nettleseren foretrekker
engelsk foran skandinaviske språk.

- Teksten i koden er norsk og sendes gjennom `t("…")`: `getT()` fra `lib/i18n/server.ts` i
  serverkomponenter, `useT()` fra `components/LocaleProvider.tsx` i klientkomponenter.
  Variabler skrives `t("{n} prosjekter", { n })`.
- Den engelske ordboka er `lib/i18n/en.ts`, med den norske teksten som nøkkel. Mangler en
  oversettelse, vises norsk. `tests/i18n.test.ts` feiler hvis en tekst i `t()` mangler
  engelsk, eller hvis variablene ikke stemmer.
- Oversatt: navigasjon, forside og strøm, profil, prosjektside, CV (også `?sprak=en` på
  CV-en uavhengig av resten av siden), utforsk, stillinger, bedrifter, priser, innlogging og
  registrering, `/utviklere` og feilsidene. Redigeringssider, admin, e-poster og de juridiske
  sidene (vilkår, personvern) er foreløpig bare på norsk.

## CV-import

«Fyll ut feltene fra CV-en» leser PDF- og Word-filer helt lokalt på serveren, uten
språkmodell eller andre betalte tjenester. `lib/cv-extract.ts` henter ut tekstlinjene med
skriftstørrelse og innrykk (og leser to spalter hver for seg), og `lib/cv-text-parser.ts`
finner overskrifter (Erfaring, Utdanning, Skills …), datoer («aug. 2021 – nå», «01/2019»),
rolle/arbeidsgiver, grad/skole, ferdigheter, lenker og bosted. Resultatet er et utkast som
brukeren ser over før det lagres. Bilder av CV-er kan vises på profilen, men ikke leses.

Testene (`npm test`) kjører tolkeren på eksempel-CV-er i `tests/fixtures/` (én og to
spalter, LinkedIn-eksport, datoer til høyre/venstre og en Word-fil). Finner dere en CV som
leses feil, legg den (anonymisert) i `tests/fixtures/` og lag en test for den.

Alle Server Actions returnerer `{ ok: true, data }` eller `{ ok: false, error, fieldErrors? }`,
så skjemaer kan vise feilmeldinger uten try/catch. Alt som endrer data sjekker at brukeren
er logget inn og eier det som endres.

## Tema og navigasjon

Appen har tre temaer: `midnight` (standard), `dark` og `light`. `ThemeProvider` setter
`data-theme` på `<html>`, og alle farger er CSS-variabler i `app/globals.css`. Derfor bytter
både klientkomponenter og server-sider farge sammen. Bruk disse klassene i ny kode:

| Klasse | Brukes til |
| --- | --- |
| `bg-ink` | sidebakgrunn (bak den står et fast «lys», `--ambient`, som glasset viser) |
| `glass-card` | kort og grupper i innholdet (gjennomskinnelig, uten uskarphet) |
| `glass` | navigasjon og flytende knapper (klart glass som gjør det bak uskarpt) |
| `glass-strong` | menyer, dialoger og varsler (tettere glass) |
| `glass-chip` | sekundærknapper, merker og sporet i segmenterte valg |
| `glass-thumb` | markøren i segmenterte valg og valgt fane |
| `glass-rim` | glasskant oppå et bilde (legg et tomt `<span>` sist i bildeboksen) |
| `glass-dark` | glass over bilder (alltid mørkt, hvit tekst) |
| `bg-fill` / `bg-fill-2` | felter og hover |
| `border-line` | streker og rammer |
| `text-fg` / `text-mist` | vanlig og dempet tekst |
| `text-ice` | lenker |
| `bg-primary text-on-primary` | hovedknapper |
| `caption` / `display` | liten overskrift over en seksjon / store titler |

Fonten er Geist (`next/font/google` i `app/layout.tsx`), som ligger nær Aeonik i formen.
Aeonik fra CoType Foundry er en betalt font. Har dere lisens, legg filene i `app/fonts/`
og bytt `Geist(...)` med `localFont({ src: [...], variable: "--font-geist" })` fra
`next/font/local`, så brukes den overalt uten flere endringer.

`components/Sidebar.tsx` (desktop) og `components/MobileNav.tsx` (mobil) ligger i
`app/layout.tsx`, så alle sider får navigasjon automatisk. Menyvalgene endrer seg etter om
man er logget inn. Logoen står øverst til venstre (`components/nav/HomeLogo.tsx`). Sider legger
inn `md:pl-28` for å gi plass til sidemenyen.

Rutene heter `/sok`, `/logg-inn`, `/ny` og `/varsler`. `/explore` og `/login` sender videre
til de to første, så gamle lenker fortsatt virker. `/@brukernavn` skrives om til
`/profil/brukernavn` i `next.config.ts`, så begge adressene virker.

## Deploy på Vercel

1. Importer repoet i Vercel.
2. Storage → Create Database → Neon (Postgres). `DATABASE_URL` settes automatisk.
3. Storage → Create → Blob. `BLOB_READ_WRITE_TOKEN` settes automatisk.
4. Legg inn `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (f.eks. `https://vis.no`), og GitHub-nøklene under Settings → Environment Variables.
5. Kjør migreringene mot produksjonsdatabasen: `DATABASE_URL=<prod-url> npm run db:migrate`.

## Deploy på Render + Neon

**Neon** (console.neon.tech): lag et prosjekt i regionen *AWS Europe Central 1 (Frankfurt)*.
Under *Connect* finnes to strenger: den med *Connection pooling* på (verten inneholder
`-pooler`) er `DATABASE_URL`, den uten er `DATABASE_URL_UNPOOLED`.

**Render** (dashboard.render.com): New → Web Service, koble til repoet, region *Frankfurt*.

| Felt | Verdi |
| --- | --- |
| Language | Node |
| Build Command | `npm ci && npm run db:migrate && npm run build` |
| Start Command | `npm run start` |

Miljøvariabler: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL` (Render-adressen, f.eks. `https://vis.onrender.com`), `NODE_VERSION=22`,
og valgfritt `BREVO_API_KEY` + `EMAIL_FROM`, GitHub-/Google-nøklene og `ADMIN_EMAILS`.
Ikke sett `NODE_ENV`: da hopper `npm ci` over devDependencies som bygget trenger.

Migreringene kjøres automatisk i hvert bygg. Uten `BLOB_READ_WRITE_TOKEN` lagres bilder og
CV-er i Neon-databasen (Render sin disk tømmes ved hver omstart). Bildene krympes til maks
2400 px WebP, så de tar lite plass. Neon sitt gratisnivå har 0,5 GB; blir det trangt, sett
`BLOB_READ_WRITE_TOKEN` fra en Blob-store på vercel.com, så havner nye filer der.

### Eget domene for appen (visplatform.no)

Domenet er registrert hos Norgesdomene, og DNS ligger hos dem (`ns1/ns2.norgesdns.no`).
Gjør stegene i denne rekkefølgen, så siden aldri er nede underveis:

1. **Render** → tjenesten → *Settings* → *Custom Domains* → *Add Custom Domain*:
   `visplatform.no`. Render legger selv til `www.visplatform.no` og sender den til rotdomenet.
2. **Norgesdomene** → domenet → DNS: fjern eventuelle standardposter (parkeringsside,
   videresending, AAAA-poster), og legg inn:

   | Type | Navn | Verdi |
   | --- | --- | --- |
   | A | `@` (visplatform.no) | `216.24.57.1` |
   | CNAME | `www` | `<tjenesten>.onrender.com` (adressen Render-tjenesten har nå) |

3. Vent til begge domenene er *Verified* og har sertifikat hos Render (som regel minutter,
   noen ganger opptil et par timer). Sjekk at `https://visplatform.no` viser appen.
4. Oppdater innloggingen, fordi tilbakekallsadressen flyttes til domenet:
   - GitHub OAuth-appen: *Authorization callback URL* =
     `https://visplatform.no/api/auth/callback/github` og *Homepage URL* = `https://visplatform.no`.
   - Google: legg til `https://visplatform.no/api/auth/callback/google` under *Authorized
     redirect URIs*, `https://visplatform.no` under *Authorized JavaScript origins* og
     `visplatform.no` under *Authorized domains* på OAuth-samtykkeskjermen.
5. **Render** → *Environment*: `BETTER_AUTH_URL=https://visplatform.no` (uten / på slutten).
   Lagre og deploy. Fra nå sender `proxy.ts` sider på onrender.com-adressen og
   `www.visplatform.no` videre til `https://visplatform.no`. API-et (`/api/...`) svarer
   fortsatt på onrender.com-adressen, så webhooks og cron virker mens du flytter dem.
6. Flytt det som peker på den gamle adressen: Stripe-webhooken
   (`https://visplatform.no/api/stripe/webhook`), cron-jobben for ukesoppsummeringen og
   `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` hvis det brukes. Send gjerne inn
   `https://visplatform.no/sitemap.xml` i Google Search Console.

Innlogginger på den gamle adressen gjelder ikke på domenet (informasjonskapsler følger
adressen), så brukerne må logge inn på nytt én gang.

### E-post (bekreftelse og glemt passord)

Render sin gratisversjon blokkerer SMTP, så e-post sendes via HTTP-API-et til Brevo:

1. Lag en gratis konto på brevo.com (300 e-poster/dag).
2. *Senders, Domains & Dedicated IPs* → *Senders* → legg til og bekreft avsenderadressen.
3. *SMTP & API* → *API Keys* → lag en nøkkel.
4. På Render: `BREVO_API_KEY=<nøkkelen>` og `EMAIL_FROM=Vis <adressen du bekreftet>`.

Når dette er satt, må nye brukere bekrefte e-posten med en 6-sifret kode før de kan logge
inn, og «Glemt passordet?» vises på innloggingen (også med kode). Eksisterende brukere som
ikke har bekreftet, får en kode første gang de logger inn. Under utvikling uten e-postnøkler
skrives koden til terminalen.
