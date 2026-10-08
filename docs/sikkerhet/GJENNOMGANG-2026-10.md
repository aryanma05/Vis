# Sikkerhetsgjennomgang oktober 2026

Gjennomgang av kodebasen på grenen `sikkerhet-lansering` (fra `samarbeid-prosjekter`), 2026-10-08.
Brukt som sjekkliste: OWASP Top 10 (2021) og relevante deler av OWASP ASVS 4.0 nivå 2.

## Hva som ble undersøkt

- Arkitektur, avhengigheter (`npm audit`), konfigurasjon (`next.config.ts`, `proxy.ts`, CI, `.env.example`).
- Innlogging, økter, e-postbekreftelse, glemt passord, to-trinns innlogging, admin (`lib/auth.ts`, `lib/admin.ts`).
- Alle 29 filer med Server Actions: at hver handling krever innlogging (bare innlogging med kode og søk er
  åpne, og det er meningen) og sjekker eierskap.
- Alle API-ruter, filruten `/filer`, cron, Stripe-webhook, avmelding, CSV-eksport, innbyggingskort.
- XSS (markdown, JSON-LD, innbygging, lenker), SQL, SSRF (skjermbilder, webhooks, GitHub), åpne videresendinger.
- Filopplasting og CV: typer, størrelser, lagring, synlighet, sletting.
- Personopplysninger i API-svar, logger, eksport, sletting og lagringstid.
- Mønstersøk etter nøkler i koden og hele Git-historikken (ingen funnet).

Ikke undersøkt: produksjonsoppsettet hos Render, Neon, Brevo og Stripe (ingen tilgang), og
bedriftsdelen i dybden utover tilgangsmatrisen og eksisterende tester.

## Funn

| # | Alvor | Funn | Sted | Status |
| --- | --- | --- | --- | --- |
| K1 | Kritisk | Next.js 16.3.5 har kjente sårbarheter: fjernkjøring av kode i `next/og` (brukes i delingsbildene), SSRF i bildeoptimalisering, cache-forgiftning | `package.json` | **Rettet:** 16.3.8 |
| H1 | Høy | Better Auth sine admin-endepunkter (`/api/auth/admin/impersonate-user`, `set-user-password`, `set-role`, `list-users` …) var åpne over HTTP for alle med admin-rollen, selv om appen aldri bruker dem | `lib/auth.ts` | **Rettet:** stengt i `hooks.before` |
| H2 | Høy | `ADMIN_EMAILS` ga admin uten bekreftet e-post (og rollen ble lagret ved registrering). Med e-postbekreftelse av kunne hvem som helst registrere seg med en admin-adresse som ikke hadde konto | `lib/admin.ts`, `lib/auth.ts` | **Rettet** |
| H3 | Høy | Admin krevde ikke to-trinns innlogging | `lib/admin.ts` | **Rettet** (i produksjon) |
| H4 | Høy | IP-grensene stoler på første verdi i `X-Forwarded-For`, som trolig kan forfalskes bak Render/Cloudflare. Ingen grense per konto på innlogging | `lib/request-ip.ts`, auth-ruten | **Delvis:** grense per konto og `TRUSTED_IP_HEADER` lagt til. Riktig header må settes hos Render |
| H5 | Høy | Utvikling og produksjon deler database (`.env.local` peker mot produksjon). Testdata skrives dit, og en migrering fra en gren har tatt ned siden | drift | **Åpen:** krever oppsett hos Neon |
| M1 | Middels | Nye CV-dokumenter var offentlige som standard. Med Vercel Blob var «skjulte» CV-filer likevel åpne for alle med lenken | `lib/cv-document.ts`, `lib/storage.ts` | **Rettet** |
| M2 | Middels | Ingen Content-Security-Policy | `next.config.ts` | **Rettet** (med `'unsafe-inline'` for skript, se under) |
| M3 | Middels | «Send ny kode» gikk utenom Better Auth sin grense per IP. Kunne brukes til å sende kode-e-poster til mange adresser og bruke opp Brevo-kvoten (300/døgn) | `app/actions/auth.ts` | **Rettet** |
| M4 | Middels | `/update-user` og `/sign-up/email` tok imot felt appen ellers validerer selv (`image` til hvilken som helst adresse, navn uten lengdegrense) | Better Auth | **Rettet:** bare kjente felt godtas |
| M5 | Middels | sharp < 0.35.5 (sårbarhet i librsvg). Lav reell risiko fordi SVG avvises før sharp | `package.json` | **Rettet:** 0.35.5 |
| M6 | Middels | E-postbekreftelse og «Glemt passord» er av i produksjon hvis e-post ikke er satt opp; registreringen avslører da hvem som har konto | `lib/auth.ts`, `lib/mailer.ts` | **Åpen:** kan ikke verifiseres herfra, se sjekklisten |
| L1 | Lav | Ingen måte å logge ut andre enheter på | Konto | **Rettet** |
| L2 | Lav | Hele den tolkede CV-en ble liggende i `cv_import` for alltid | `lib/cv.ts` | **Rettet:** slettes ved bruk og etter ett døgn |
| L3 | Lav | Ubegrenset minnekart i «Send ny kode» | `app/actions/auth.ts` | **Rettet** |
| L4 | Lav | `source-map-js` (DoS, bare i byggesteget) | lockfile | **Rettet:** 1.2.2 |
| L5 | Lav | Utlogging og utestenging virker først fullt ut etter opptil 5 minutter (øktmellomlager) | `lib/auth.ts` | Akseptert, dokumentert |
| L6 | Lav | Ingen sjekk mot lekkede passord | `lib/auth.ts` | Åpen (valgfritt, sender data til tredjepart) |
| L7 | Lav | Gjenværende moderate sårbarheter i `drizzle-kit` (bare utvikling) og `mammoth` → `argparse` (bare CLI-delen) | lockfile | Akseptert |

Det som allerede var bra: eierskap sjekkes i alle endringer, zod-validering, sanert markdown, SSRF-vern
med DNS-sjekk, filtype fra innholdet, EXIF fjernes, private filer bare for eieren, signaturer sjekkes i
konstant tid, API-nøkler lagres som hash, dataeksport og sletting med cascade, lagringstid for søknader.

## Endringer

| Fil | Endring |
| --- | --- |
| `package.json`, `package-lock.json` | next 16.3.8, eslint-config-next 16.3.8, sharp 0.35.5, source-map-js 1.2.2 |
| `lib/auth-rules.ts` (ny) | Regler uten database: stengte stier, tillatte felt, grenser per konto/e-post, `isAdminUser`, `adminNeeds2fa` |
| `lib/auth.ts` | `hooks.before` med reglene; admin-rollen settes ikke lenger ved registrering |
| `lib/admin.ts`, `app/admin/page.tsx` | Admin krever bekreftet e-post, og to-trinns innlogging i produksjon (egen beskjed på `/admin`) |
| `app/prosjekt/[id]/page.tsx`, `app/actions/comments.ts` | Admin-visning og -sletting bare for aktiv admin |
| `lib/request-ip.ts`, `app/api/auth/[...all]/route.ts` | Felles IP-logikk for appen og Better Auth, med `TRUSTED_IP_HEADER` |
| `app/admin/SystemTab.tsx` | Viser hvilke IP-headere serveren får, så riktig header kan velges |
| `lib/rate-limit.ts`, `lib/auth-errors.ts` | Nye grenser (`loginAccount`, `authEmail`, `authCode`) og meldinger |
| `app/actions/auth.ts` | Grense per IP på «Send ny kode» |
| `lib/storage.ts`, `lib/cv-document.ts`, `CvDocumentPanel.tsx` | CV skjult som standard, alltid i databasen, forklaring i skjemaet |
| `lib/csp.ts` (ny), `next.config.ts` | Content-Security-Policy |
| `lib/account.ts`, `AccountForms.tsx`, `konto/page.tsx` | «Logg ut på andre enheter» med antall innlogginger |
| `lib/cv.ts`, `lib/retention.ts` | CV-importutkast tømmes ved bruk og etter ett døgn |
| `lib/env.ts` | Advarsel når `TRUSTED_IP_HEADER` mangler i produksjon |
| `app/personvern/page.tsx` | Riktig beskrivelse av CV-synlighet og hvor CV-filer lagres |
| `.github/workflows/ci.yml` | `npm audit --omit=dev --audit-level=high` |
| `lib/i18n/en.ts` | Engelske tekster for alt nytt |
| `tests/security.test.ts` (ny), `tests/access-control.test.ts` (ny), `tests/env.test.ts` | Tester, se under |
| `SECURITY.md`, `docs/sikkerhet/*`, `README.md`, `.env.example` | Dokumentasjon |

Ingen databasemigrering. Standardverdien `cv_document.is_public = true` i skjemaet er beholdt; koden setter
verdien selv ved opplasting.

**Merk ved deploy:** admin uten to-trinns innlogging mister tilgangen til `/admin` til de slår det på.

## Tester og kontroller

| Kommando | Resultat |
| --- | --- |
| `npx tsc --noEmit` | OK (før og etter) |
| `npm run lint` | 0 feil, 3 advarsler (`<img>` i delingsbildene, fantes fra før) |
| `npx tsx --conditions=react-server --test` på de ni filene uten database (i18n, achievements, site, cv-parser, company-permissions, roi, templates, env, security) | 91 av 91 OK |
| `next build` (Next 16.3.8, lokalt, `--max-old-space-size=2048`) | OK, 56 sider. CSP-en ligger i `.next/routes-manifest.json` |
| `npm audit --omit=dev --audit-level=high` | OK (0 høye/kritiske; 7 moderate i dev-verktøy/CLI) |
| Mønstersøk etter nøkler i hele Git-historikken | Ingen funnet |
| Databasetestene (11 eksisterende + `tests/access-control.test.ts`) | **Ikke kjørt lokalt**, fordi `.env.local` er produksjon. Kjøres i GitHub Actions mot en tom Postgres |

`tests/access-control.test.ts` dekker: utkast skjult for andre og uten innlogging; B kan ikke endre,
publisere, feste, slette eller bytte beskrivelse på A sine prosjekter, bilder og oppdateringer; ingen
kommentarer på utkast, og B kan ikke endre eller slette A sine; private samlinger; samarbeidsutlysninger
(inkl. at B ikke ser forespørsler eller e-post); varsler; ny CV er privat, direkte lenke gir 404 til den
gjøres synlig og igjen når den skjules; dataeksport krever innlogging; admin-endepunktene gir 404 over
HTTP; registrering med ekstra felt avvises; innlogging stoppes per konto etter ti forsøk. Filen leser
ikke `.env.local` og kjører bare mot en lokal database eller med `TEST_DATABASE_OK=1`.

Ikke testet:

- I nettleser: CSP-en, «Logg ut på andre enheter», CV-flyten og admin-beskjeden. Ingen ende-til-ende-tester
  finnes i prosjektet.
- Om `X-Forwarded-For` faktisk kan forfalskes hos Render (krever kall mot produksjon, se sjekklisten).
- Produksjonsoppsettet: miljøvariabler, e-post, sikkerhetskopier, tilganger hos leverandørene.
- Ingen angrep, lasttester eller andre tester mot produksjon.

## Gjenværende risiko

- CSP-en tillater inline-skript, så den er et ekstra lag, ikke full beskyttelse mot XSS.
- IP-grensene kan omgås til `TRUSTED_IP_HEADER` er satt riktig. Grensene per konto begrenser skaden.
- Grensen per konto kan misbrukes til å stenge en annen persons innlogging i et kvarter.
- Ingen virusskanning av opplastede PDF-er.
- Ingen overvåking eller varsling er satt opp (utover feilloggen i admin).
- Sikkerhetskopier og gjenoppretting er ikke testet.
- Juridisk vurdering av personvern (behandlingsgrunnlag, databehandleravtaler, overføring utenfor EØS)
  er ikke gjort.

## Lanseringsvurdering

**Klar for begrenset beta**, når punkt 1–4 under «Blokkerer lansering» i
[PRODUKSJONSSJEKKLISTE.md](PRODUKSJONSSJEKKLISTE.md) er gjort og CI er grønn på grenen.

Ikke klar for offentlig lansering før også punkt 5 (juridisk), 6 (testet gjenoppretting) og 7
(overvåking) er på plass, og CSP-en og de viktigste flytene er sjekket i en nettleser etter deploy.
Koden har gode kontroller, men vurderingen kan ikke bli bedre enn produksjonsoppsettet, som ikke er
verifisert.
