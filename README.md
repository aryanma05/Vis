# vis

A visual portfolio platform for developers, designers and digital creators.

## About

vis brings your CV, projects and digital identity together in one visual profile.

En norsk «GitHub for digitale profiler»: et visuelt visittkort, en strukturert CV og
prosjektene dine på én lenke (`/@brukernavn`), pluss en feed der man oppdager hva andre lager.

### Funksjoner

- **Profil** på `/@brukernavn` med visittkort, README-seksjon, egne seksjoner, aksentfarge,
  «åpen for»-status, prosjekter (festede først), aktivitetskart og følgere.
- **CV** på `/@brukernavn/cv` i tre maler (klassisk, moderne, kompakt), redigerbar
  med dra-og-slipp, import fra PDF/Word/bilde (fyller ut automatisk med `ANTHROPIC_API_KEY`)
  og eksport som PDF via utskrift.
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
| `ANTHROPIC_API_KEY` | Språkmodellen som leser CV-er | Nei, bare for CV-import |
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
lib/cv.ts, cv-parser.ts   strukturert CV: lagring, redigering og tolking av PDF/Word/bilde
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
app/filer/[...key]        serverer filer lagret i databasen (skjult CV bare for eieren)
app/actions/*.ts          Server Actions som skjemaene kaller
components/ui/            knapper, felt, dialoger, menyer, faner, toasts, brytere
components/               ProjectCard, ProjectCover, ImageEditor (beskjæring), kommentarer osv.
```

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
4. Legg inn `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (f.eks. `https://vis.no`), GitHub-nøklene og `ANTHROPIC_API_KEY` under Settings → Environment Variables.
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
og valgfritt `BREVO_API_KEY` + `EMAIL_FROM`, GitHub-/Google-nøklene, `ADMIN_EMAILS` og `ANTHROPIC_API_KEY`.
Ikke sett `NODE_ENV`: da hopper `npm ci` over devDependencies som bygget trenger.

Migreringene kjøres automatisk i hvert bygg. Uten `BLOB_READ_WRITE_TOKEN` lagres bilder og
CV-er i Neon-databasen (Render sin disk tømmes ved hver omstart). Bildene krympes til maks
2400 px WebP, så de tar lite plass. Neon sitt gratisnivå har 0,5 GB; blir det trangt, sett
`BLOB_READ_WRITE_TOKEN` fra en Blob-store på vercel.com, så havner nye filer der.

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
