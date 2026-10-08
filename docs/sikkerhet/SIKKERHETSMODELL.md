# Sikkerhetsmodell

Hvordan Vis beskytter kontoer og data, og hvor i koden det skjer. Det som må settes opp hos Render,
Neon og andre leverandører, står i [PRODUKSJONSSJEKKLISTE.md](PRODUKSJONSSJEKKLISTE.md).

## Oversikt

| Del | Teknologi |
| --- | --- |
| App | Next.js 16 (App Router, Server Actions), hos Render (Frankfurt) |
| Innlogging | Better Auth 1.7 (`lib/auth.ts`) |
| Database | Postgres hos Neon (Frankfurt), Drizzle ORM (`db/schema.ts`) |
| Filer | Databasen (`stored_file`, servert fra `/filer/…`), eller Vercel Blob for offentlige bilder |
| E-post | Brevo eller Resend (`lib/mailer.ts`) |
| Betaling | Stripe (`lib/stripe.ts`, `lib/billing.ts`) |

All tilgangskontroll skjer på serveren. Knapper som skjules i grensesnittet er bare for brukervennlighet.

## Innlogging og kontoer

- **Passord** hashes med scrypt av Better Auth. 8 til 128 tegn. Ingen egen kryptografi i appen.
- **E-postbekreftelse** med en sekssifret kode (lagret som hash, gyldig i 10 minutter, maks 5 forsøk per
  kode) før man kan logge inn. Gjelder bare når e-post er satt opp (`BREVO_API_KEY`/`RESEND_API_KEY` +
  `EMAIL_FROM`). Uten det er bekreftelse av i produksjon, og registreringen avslører om en e-post har konto.
  Derfor er manglende e-post en «Må fikses» under `/admin?fane=system`.
- **Glemt passord** med kode på e-post. Nytt passord logger ut alle andre enheter
  (`revokeSessionsOnPasswordReset`).
- **Bytte passord** krever det nåværende og logger ut andre enheter.
- **To-trinns innlogging** (TOTP-app og reservekoder) under Konto. Feil koder låser midlertidig.
  Hemmelighetene krypteres med `BETTER_AUTH_SECRET` (se «Nøkler» under).
- **GitHub og Google**. OAuth-nøklene til GitHub lagres kryptert (`encryptOAuthTokens`).
- **Sletting av konto** krever passordet (eller en fersk innlogging for kontoer uten passord).

### Grenser mot gjetting og misbruk

| Hva | Grense | Hvor |
| --- | --- | --- |
| Innlogging per IP | 10 per minutt | `lib/auth.ts` (`rateLimit.customRules`) |
| **Innlogging per konto** | 10 per 15 min, uansett IP | `lib/auth-rules.ts` → `hooks.before` |
| **E-post med kode per adresse** | 6 per time | samme |
| E-post med kode per IP | 3 per minutt | `lib/auth.ts` |
| «Send ny kode» per IP | 10 per time | `app/actions/auth.ts` |
| To-trinnskoder | 10 per minutt per IP, og lås etter feil forsøk | Better Auth |
| Handlinger i appen | per bruker (`RULES` i `lib/rate-limit.ts`) | `enforce()` |

Grensene per konto stopper gjetting selv om noen bytter (eller forfalsker) IP-adresse. Ulempen er at
noen kan stenge innloggingen for en annen konto i et kvarter. «Glemt passordet?» virker fortsatt.

Identifikatorene lagres som SHA-256-hash i `rate_bucket`, ikke i klartekst.

**Klientens IP** hentes i `lib/request-ip.ts`, som både appens grenser og Better Auth bruker. Er
`TRUSTED_IP_HEADER` satt, brukes den headeren. Ellers brukes første verdi i `X-Forwarded-For`, som
klienten kan styre selv hvis proxyen legger til i stedet for å erstatte. Se sjekklisten.

### Felt som kan sendes til Better Auth

`hooks.before` i `lib/auth.ts` avviser (`lib/auth-rules.ts`):

- alle Better Auth sine admin-endepunkter (`/api/auth/admin/*`: logge inn som andre, sette passord,
  endre rolle, liste alle brukere). Appen modererer selv i `lib/admin.ts`.
- ukjente felt ved registrering (f.eks. `image`, `role`), og navn over 100 tegn.
- alt annet enn brukernavnet på `/update-user`. Navn og bilde endres via `lib/profiles.ts`, som validerer.

## Økter

- Informasjonskapsel med `HttpOnly`, `SameSite=Lax`, og `Secure` når adressen er https.
- Gyldig i 7 dager og fornyes daglig ved bruk. Ligger i tabellen `session`, så den kan tilbakekalles.
- Økten mellomlagres i en signert informasjonskapsel i 5 minutter (`cookieCache`). En utestengt eller
  utlogget økt kan derfor virke i opptil 5 minutter til.
- **Logg ut på andre enheter** under Konto → Innlogginger (`authClient.revokeOtherSessions`).
- Utestenging fra admin sletter alle økter for brukeren (`banUser` i `lib/admin.ts`).

### CSRF

Better Auth sjekker `Origin` mot `BETTER_AUTH_URL` (og Render-adressen) på alle endringer. Server Actions
godtar bare POST, og Next sammenligner `Origin` med `Host`. Ingen ruter med sideeffekter svarer på GET,
bortsett fra språkbytte (`/sprak`, bare en informasjonskapsel) og klikk-telleren på stillinger.

## Admin

- Admin er rollen `admin` i databasen, eller en **bekreftet** e-post i `ADMIN_EMAILS` (`isAdminUser`).
  Rollen settes ikke lenger automatisk når en konto lages.
- I produksjon krever all admin-bruk **to-trinns innlogging**. Uten det viser `/admin` bare en beskjed om
  å slå det på, og handlingene avvises (`requireAdminForAction`).
- Admin kan fjerne og gjenopprette prosjekter, slette kommentarer, stenge kontoer (med varighet), gi Pro
  eller Bedrift uten betaling, og bekrefte bedrifter. Hver handling logges (`admin.*` i loggen).
- Admin kan ikke logge inn som andre, sette passord eller slette kontoer (de endepunktene er stengt).

## Tilgang til data

Alle endringer sjekker eierskap på serveren, med brukerens id fra økten og aldri fra skjemaet:

- Prosjekter, bilder, oppdateringer: `assertOwner` i `lib/projects.ts` og spørringer med `ownerId`.
- Kommentarer: forfatteren kan endre; forfatter, prosjekteier og admin kan slette.
- Samlinger, samarbeid, varsler, kontaktforespørsler: alle spørringer filtrerer på eieren.
- Bedrifter: rollematrisen i `lib/company-permissions.ts`, gjennom `requireCompanyPermission`, med
  bedriftens krav om to-trinns innlogging og godkjent databehandleravtale.
- Utkast, fjernet innhold og utestengte brukere er skjult for alle andre (`publicProject()`).

Tester: `tests/access-control.test.ts` (bruker A mot bruker B, og uten innlogging),
`tests/company-permissions.test.ts`, `tests/bedrift.test.ts`, `tests/privacy.test.ts`.

## Input og vanlige angrep

- **Validering:** zod-skjemaer i `lib/validation.ts` med maks lengde, antall og tillatte verdier.
  Server Actions tar maks 13 MB.
- **SQL:** Drizzle med parametre. `sql\`…\`` setter verdiene inn som parametre, ikke som tekst.
- **XSS:** React escaper all tekst. Markdown går gjennom `rehype-sanitize` (`components/Markdown.tsx`).
  JSON-LD escapes `<`. Innbyggingskortene escapes med `escapeHtml`. Lenker må være `http(s)`.
- **Content-Security-Policy** (`lib/csp.ts`): skript bare fra appen selv (pluss statistikken hvis den er
  på), ingen `<object>`, ingen `<base>`, skjemaer bare til appen, ingen innramming på andre sider,
  og fetch bare til appen. Fordi Next legger inn egne inline-skript uten nonce, tillates `'unsafe-inline'`
  for skript. Policyen stopper derfor ikke en injisert inline-`<script>`, men stopper skript fra andre
  domener og begrenser hvor data kan sendes. Strengere (nonce) krever at alle sider rendres per forespørsel.
- **Andre headere** (`next.config.ts`): HSTS (2 år), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`. Innbyggingskortene (`/bygg-inn/*`) har egne, strengere regler.
- **CORS:** bare det åpne API-et (`/api/v1`, bare lesing av offentlige data) svarer med `*`.
- **SSRF:** skjermbilder og webhooks slår opp DNS og avviser private adresser, også for omdirigeringer og
  underressurser (`lib/screenshots.ts`, `lib/webhooks.ts`). GitHub-kall går bare til api.github.com.
- **Åpne videresendinger:** `safeInternalPath` i `lib/safe-path.ts`.
- **Feilmeldinger:** uventede feil gir «Noe gikk galt» til brukeren; detaljene havner i loggen.

## Filer og CV-er

- Filtypen avgjøres av innholdet (`lib/file-signatures.ts`), ikke av navn eller MIME-type. Bare JPG, PNG,
  WebP, GIF, AVIF og PDF. SVG og HTML avvises.
- Bilder dekodes og lagres på nytt som WebP med sharp (maks 2400 px), som også fjerner EXIF og GPS.
- Filnavnene lages av serveren (`<mappe>/<uuid>.<type>`). Filer serveres med riktig `Content-Type` og
  `nosniff`, så de aldri tolkes som HTML eller skript.
- **CV-dokumenter er skjult som standard**, og ligger **alltid i databasen**, også når Vercel Blob er satt
  opp (Blob-filer er offentlige for alle med lenken). En skjult CV gir 404 for alle andre enn eieren, også
  med en direkte lenke, og svaret er `Cache-Control: private, no-store`. Eieren gjør den synlig under
  Rediger profil → CV. `robots.txt` stenger `/filer/cv/`.
- Ingen virusskanning. Bilder er tryggere fordi de lages på nytt. PDF-er vises i nettleserens egen
  PDF-leser. På serveren leses teksten med pdf.js 6, som ikke lager kode av filinnholdet (ingen eval).
- Filer slettes sammen med prosjektet, CV-en eller kontoen (`deleteAllFilesOfUser`).

## Personvern

| Synlig for | Hva |
| --- | --- |
| Alle (også API og innbyggingskort) | navn, brukernavn, profilbilde, profiltekst, publiserte prosjekter, kommentarer, reaksjoner, følgere, det man har fylt inn i CV-en (erfaring, utdanning, ferdigheter), CV-dokumentet hvis det er gjort synlig |
| Bedrifter | profilen i kandidatsøket bare hvis «Synlig for bedrifter» er på (av som standard); e-post bare når man selv søker eller svarer |
| Bare eieren | e-post, utkast, skjult CV, varsler, private samlinger, innsikt |

- **Innsyn og dataportabilitet:** Konto → «Last ned alt vi har lagret om deg» (`/api/mine-data`, JSON).
- **Sletting:** Konto → Slett konto. Alt slettes med en gang (cascade i databasen), sammen med filene og
  abonnementet hos Stripe. Sikkerhetskopier hos Neon forsvinner når lagringstiden der går ut.
- **Lagringstid** (`lib/retention.ts`, daglig jobb): søknader 12 måneder etter siste endring (kortere hos
  bedrifter som velger det), kontaktforespørsler 24 måneder, innholdet i CV-importutkast etter ett døgn,
  feilloggen 30 dager, grensetellere 2 dager.
- **Logger:** JSON-linjer uten headere, informasjonskapsler, passord eller koder. Feil kan inneholde
  bruker-id og sti. Feilloggen under `/admin` har samme innhold.
- **Informasjonskapsler:** bare økten og språkvalget. Besøksstatistikken (Plausible/Umami) bruker ingen.
- Teksten for brukerne står på `/personvern` og `/vilkar`.

Dette er tekniske tiltak. Om plattformen oppfyller personvernforordningen (GDPR) må vurderes juridisk,
se sjekklisten.

## Nøkler

- `BETTER_AUTH_SECRET` signerer økter og krypterer to-trinnshemmeligheter og OAuth-nøkler. Bytter man
  den rett ut, slutter to-trinns innlogging å virke for alle. Roter med `BETTER_AUTH_SECRETS="1:<ny>"`
  og la den gamle stå i `BETTER_AUTH_SECRET`, så eldre krypterte verdier fortsatt kan leses. Se [HENDELSER.md](HENDELSER.md).
- API-nøkler for utviklere lagres som SHA-256-hash og vises én gang (`lib/api-keys.ts`).
- Webhooks signeres med HMAC-SHA256 per webhook. Stripe-webhooks og cron-kall sjekkes med konstant-tid
  sammenligning.
- Et mønstersøk etter kjente nøkkelformater i koden og hele Git-historikken fant ingenting (2026-10-08).
  `.env*` er i `.gitignore`.

## Kjente begrensninger

- CSP-en tillater inline-skript (se over).
- 5 minutters forsinkelse før en tilbakekalt økt slutter å virke.
- Ingen virusskanning av PDF-er.
- Ingen sjekk mot lekkede passord (Better Auth sin `haveIBeenPwned`-plugin kan slås på; den sender de
  fem første tegnene av en SHA-1-hash til en tredjepart).
- Grensene per IP er bare så gode som `TRUSTED_IP_HEADER`.
