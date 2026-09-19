# vis

A visual portfolio platform for developers, designers and digital creators.

## About

vis brings your CV, projects and digital identity together in one visual profile.

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- OGL
- Postgres (Neon på Vercel) + Drizzle ORM
- Better Auth (e-post/passord + GitHub)
- Vercel Blob (bilder)

## Kjør lokalt

```bash
npm install
cp .env.example .env.local   # fyll inn verdiene, se under
npm run db:migrate           # lager tabellene
npm run db:seed              # valgfritt: eksempelbrukeren @aryan (passord123)
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
lib/projects.ts           prosjekter: lese, opprette, endre, slette, bilder, feed, søk
lib/github.ts             GitHub-import (repoliste, README → prosjekt)
lib/cv.ts, cv-parser.ts   CV: import fra PDF/Word, lagring og redigering
lib/profiles.ts           profilsider
lib/storage.ts            bildeopplasting (Vercel Blob / lokalt)
app/actions/*.ts          Server Actions som skjemaene kaller
```

Alle Server Actions returnerer `{ ok: true, data }` eller `{ ok: false, error, fieldErrors? }`,
så skjemaer kan vise feilmeldinger uten try/catch. Alt som endrer data sjekker at brukeren
er logget inn og eier det som endres.

## Deploy på Vercel

1. Importer repoet i Vercel.
2. Storage → Create Database → Neon (Postgres). `DATABASE_URL` settes automatisk.
3. Storage → Create → Blob. `BLOB_READ_WRITE_TOKEN` settes automatisk.
4. Legg inn `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (f.eks. `https://vis.no`), GitHub-nøklene og `ANTHROPIC_API_KEY` under Settings → Environment Variables.
5. Kjør migreringene mot produksjonsdatabasen: `DATABASE_URL=<prod-url> npm run db:migrate`.
