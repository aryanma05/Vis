# Miljøvariabler

Alle variablene appen leser, uten verdier. Settes under *Environment* hos Render (og i `.env.local` lokalt,
som aldri committes). `/admin?fane=system` viser hvilke som mangler, uten å vise verdiene.

**Hemmelig** = gir tilgang til data eller tjenester. Skal aldri i koden, i loggen, i en `NEXT_PUBLIC_`-variabel
(de bakes inn i JavaScript-en som sendes til nettleseren) eller deles mellom utvikling og produksjon.

## Påkrevd i produksjon

| Variabel | Hemmelig | Hva | Ved lekkasje |
| --- | --- | --- | --- |
| `DATABASE_URL` | Ja | Postgres-tilkobling (Neon, med pooler) | Bytt passordet til databasebrukeren hos Neon |
| `DATABASE_URL_UNPOOLED` | Ja | Direkte tilkobling, brukes til migreringer | Som over |
| `BETTER_AUTH_SECRET` | Ja | Signerer økter, krypterer to-trinnshemmeligheter og OAuth-nøkler. Minst 32 tegn | Roter med `BETTER_AUTH_SECRETS`, se [HENDELSER.md](HENDELSER.md) |
| `BETTER_AUTH_URL` | Nei | Appens adresse, `https://visplatform.no` (uten `/` til slutt). Innlogging avvises fra andre adresser | – |
| `BREVO_API_KEY` eller `RESEND_API_KEY` | Ja | E-post. Uten den er e-postbekreftelse og «Glemt passord» av | Lag ny nøkkel hos leverandøren, slett den gamle |
| `EMAIL_FROM` | Nei | Avsender, f.eks. `Vis <hei@visplatform.no>` | – |
| `CONTACT_EMAIL` | Nei | Kontaktadresse på `/personvern`, `/vilkar` og i `SECURITY.md` | – |
| `GITHUB_TOKEN` | Ja | Les-token for offentlige GitHub-data (bare «Public repositories (read-only)») | Slett tokenet hos GitHub, lag et nytt |
| `TRUSTED_IP_HEADER` | Nei | Headeren proxyen setter med klientens IP. Se [sjekklisten](PRODUKSJONSSJEKKLISTE.md#3-klientens-ip-adresse) | – |
| `ADMIN_EMAILS` | Nei | Bekreftede e-poster som er admin. Admin må også ha to-trinns innlogging | – |
| `CRON_SECRET` | Ja | Beskytter `/api/cron/*`. Lang tilfeldig verdi | Bytt hos Render og i cron-tjenesten |

## Valgfrie

| Variabel | Hemmelig | Hva |
| --- | --- | --- |
| `BETTER_AUTH_SECRETS` | Ja | Ved rotasjon: `"1:<ny>"`. Den nye signerer økter og krypterer nye verdier; `BETTER_AUTH_SECRET` beholdes med den gamle verdien for å lese det som ble kryptert før |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Hemmeligheten | Innlogging med GitHub. Egen OAuth-app per miljø |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Hemmeligheten | Innlogging med Google. Egen klient per miljø |
| `STRIPE_SECRET_KEY` | Ja | Betaling. `sk_test_…` til dere er klare, så `sk_live_…`. Helst en *restricted key* |
| `STRIPE_WEBHOOK_SECRET` | Ja | Sjekker at webhooks kommer fra Stripe (`whsec_…`) |
| `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_BUSINESS_MONTHLY` | Nei | Pris-ID-er (`price_…`) |
| `BLOB_READ_WRITE_TOKEN` | Ja | Vercel Blob for offentlige bilder. CV-er lagres uansett i databasen |
| `MICROLINK_API_KEY` | Ja | Skjermbilder via Microlink med betalt kvote |
| `SCREENSHOT_BROWSER_PATH` | Nei | Egen Chromium til skjermbilder |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SRC` | Nei (offentlig) | Besøksstatistikk. Må være satt når appen *bygges*, fordi CSP-en lages da |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, `NEXT_PUBLIC_UMAMI_SRC` | Nei (offentlig) | Som over |

## Settes av plattformen

`NODE_ENV` (ikke sett den selv hos Render), `NEXT_RUNTIME`, `RENDER_EXTERNAL_URL`,
`RENDER_EXTERNAL_HOSTNAME`, `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`.

## Bare for utvikling og tester

| Variabel | Hva |
| --- | --- |
| `VIS_SEEDING` | Slår av grensene mens `npm run db:seed` kjører (aldri i produksjon) |
| `SEED_REMOTE` | `ja` for å kjøre eksempeldataene mot en database som ikke er lokal |
| `TEST_DATABASE_OK` | Lar `tests/access-control.test.ts` kjøre mot en ikke-lokal **test**database |

## Utvikling, test og produksjon

Hvert miljø skal ha **egne** verdier for alle hemmelige variabler, og en egen database. Det gjelder også
`.env.local` på utviklermaskiner: den skal peke til en egen Neon-branch eller lokal Postgres, ikke til
produksjon. Se punkt 1 i [PRODUKSJONSSJEKKLISTE.md](PRODUKSJONSSJEKKLISTE.md).
