# vis

A visual portfolio platform for developers, designers and digital creators.

## About

vis brings your CV, projects and digital identity together in one visual profile.

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- OGL (bølgene på forsiden) og lucide-react (ikoner)
- Postgres (Neon på Vercel) + Drizzle ORM
- Better Auth (e-post/passord + GitHub)
- Vercel Blob (bilder)

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
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob. Uten den lagres bilder i `public/uploads` | Nei |
| `ANTHROPIC_API_KEY` | Språkmodellen som leser CV-er | Nei, bare for CV-import |

GitHub OAuth-app: github.com/settings/developers → New OAuth App.
Callback-URL: `http://localhost:3000/api/auth/callback/github` (lag en egen app for produksjon).

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
lib/session.ts            getCurrentUser() / requireUser() for sider og actions
lib/projects.ts           prosjekter: lese, opprette, endre, slette, bilder, feed, søk, tagger
lib/github.ts             GitHub-import (repoliste, README → prosjekt)
lib/folder-import.ts      import fra lokal mappe (kjører i nettleseren, koden lastes ikke opp)
lib/cv.ts, cv-parser.ts   strukturert CV: lagring, redigering og tolking av PDF/Word/bilde
lib/cv-document.ts        CV-dokumentet som vises på profilen (PDF-sider som bilder)
lib/pdf-pages.ts          gjør PDF-sider om til bilder i nettleseren (pdf.js)
lib/comments.ts           kommentarer (og varsel til prosjekteieren)
lib/notifications.ts      varsler
lib/profiles.ts           profilsider
lib/storage.ts            filopplasting (Vercel Blob / lokalt)
app/actions/*.ts          Server Actions som skjemaene kaller
components/               ProjectCard, ProjectCover, CvPages, kommentarer osv.
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
| `bg-ink` | sidebakgrunn |
| `bg-surface` | kort, felter og menyer |
| `border-line` | streker og rammer |
| `text-fg` | vanlig tekst |
| `text-mist` | dempet tekst |
| `text-ice` | aksent på tekst og lenker |
| `bg-primary text-on-primary` | knapper |

`components/Sidebar.tsx` (desktop) og `components/MobileNav.tsx` (mobil) ligger i
`app/layout.tsx`, så alle sider får navigasjon automatisk. Menyvalgene endrer seg etter om
man er logget inn. Sider legger inn `md:pl-28` for å gi plass til sidemenyen.

Rutene heter `/sok`, `/logg-inn`, `/ny` og `/varsler`. `/explore` og `/login` sender videre
til de to første, så gamle lenker fortsatt virker.

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
`BLOB_READ_WRITE_TOKEN`, og valgfritt GitHub-nøklene og `ANTHROPIC_API_KEY`.
Ikke sett `NODE_ENV`: da hopper `npm ci` over devDependencies som bygget trenger.

Migreringene kjøres automatisk i hvert bygg. Bilder lagres i Vercel Blob også når appen
kjører på Render (Render sin disk tømmes ved hver omstart). Lag en Blob-store på vercel.com
under Storage og kopier `BLOB_READ_WRITE_TOKEN`.
