# Produksjonssjekkliste

Det som må gjøres utenfor koden før (og rett etter) offentlig lansering. Hvert punkt har en måte å sjekke
at det er gjort. Kryss av her eller i en issue.

Status per 2026-10-08: punktene er **ikke** verifisert mot produksjonsoppsettet hos Render og Neon. Bare
koden og bygget er sjekket.

## Blokkerer lansering

### 1. Egen database for utvikling

`.env.local` på utviklermaskinen peker i dag til produksjonsdatabasen. `npm test` skriver testdata dit, og
en migrering fra en gren tok ned siden 2026-10-08.

- [ ] Neon → prosjektet → *Branches* → lag en branch `utvikling` fra `main`. Bruk dens tilkoblingsstreng i
      `.env.local` (eller installer Postgres lokalt).
- [ ] Lag en **ny** `BETTER_AUTH_SECRET` for utvikling (`openssl rand -base64 32`). Produksjonens hemmelighet
      skal bare ligge hos Render.
- [ ] Bytt passordet til databasebrukeren i produksjon hos Neon (*Roles* → *Reset password*) og oppdater
      `DATABASE_URL`/`DATABASE_URL_UNPOOLED` hos Render, siden den har ligget på en utviklermaskin.
- **Sjekk:** `.env.local` inneholder ikke produksjonsverten. `npm test` kan da kjøres trygt.

### 2. E-post er satt opp

Uten e-post er e-postbekreftelse og «Glemt passord» av, og registreringen avslører hvem som har konto.

- [ ] `BREVO_API_KEY` (eller `RESEND_API_KEY`) og `EMAIL_FROM` hos Render, med bekreftet avsender.
- [ ] SPF, DKIM og DMARC for avsenderdomenet (Brevo → *Domains*), så kodene ikke havner i søppelpost.
- **Sjekk:** `/admin?fane=system` viser «E-post kan sendes». Registrer en testkonto og få koden.

### 3. Klientens IP-adresse

Grensene per IP (innlogging, registrering, API) bruker første verdi i `X-Forwarded-For` hvis ikke
`TRUSTED_IP_HEADER` er satt. Render ligger bak Cloudflare, som *legger til* i den headeren, så første
verdi kan trolig styres av klienten.

- [ ] Logg inn som admin, åpne `/admin?fane=system` og se på «Klientens IP-adresse». Finn headeren som
      inneholder bare din egen IP (sammenlign med f.eks. whatismyip.com). Vanlige kandidater er
      `cf-connecting-ip` og `true-client-ip`.
- [ ] Sett `TRUSTED_IP_HEADER` til navnet på den headeren hos Render, og deploy.
- **Sjekk** (fra din egen maskin, to kall mot det offentlige API-et, med en tilfeldig parameter så ingenting
  mellomlagres):

  ```bash
  curl -s -o /dev/null -D - -H "X-Forwarded-For: 203.0.113.1" "https://visplatform.no/api/v1/projects?limit=1&test=1" | grep -i x-ratelimit-remaining
  ```

  ```bash
  curl -s -o /dev/null -D - -H "X-Forwarded-For: 203.0.113.2" "https://visplatform.no/api/v1/projects?limit=1&test=2" | grep -i x-ratelimit-remaining
  ```

  Synker tallet fra det første til det andre kallet, telles du som samme IP, og forfalskingen virker ikke.
  Får begge 119, kan IP-en forfalskes, og `TRUSTED_IP_HEADER` er feil eller mangler.

### 4. Admin med to-trinns innlogging

I produksjon krever `/admin` nå to-trinns innlogging.

- [ ] Hver admin slår på to-trinns innlogging under Konto **før** denne versjonen deployes, og tar vare på
      reservekodene.
- [ ] `ADMIN_EMAILS` inneholder bare personer som skal være admin, og e-postene er bekreftet.
- **Sjekk:** `/admin` viser moderering (ikke beskjeden om to-trinns innlogging).

### 5. Juridisk og personvern (må vurderes av noen med kompetanse)

Dette er ikke tekniske kontroller, og koden kan ikke avgjøre dem.

- [ ] Gå gjennom `/personvern` og `/vilkar` mot det appen faktisk gjør (se
      [SIKKERHETSMODELL.md](SIKKERHETSMODELL.md#personvern)).
- [ ] Databehandleravtaler (DPA) med Render, Neon, Brevo/Resend, Stripe og eventuelt Vercel og Microlink.
- [ ] Overføring til land utenfor EØS: flere av leverandørene er amerikanske selskaper selv om dataene ligger
      i Frankfurt. Sjekk at avtalene har standard personvernbestemmelser (SCC) eller EU–US Data Privacy Framework.
- [ ] Protokoll over behandlingsaktiviteter (GDPR art. 30) og behandlingsgrunnlag for hver del.
- [ ] Aldersgrense: CV-er og stillingssøk kan gjelde personer under 18 år.
- [ ] Rutine for brudd på personopplysningssikkerheten (melding til Datatilsynet innen 72 timer), se
      [HENDELSER.md](HENDELSER.md).

## Bør gjøres før lansering

### 6. Sikkerhetskopier og gjenoppretting

- [ ] Neon → *Settings* → sjekk hvor lang historikk (point-in-time restore) planen gir. Gratisnivået har
      kort historikk. For en offentlig tjeneste bør det være minst 7 dager.
- [ ] **Test gjenoppretting:** lag en branch fra et tidspunkt tilbake i tid, koble en lokal kopi av appen til
      den, og sjekk at du kan logge inn og se profiler. Skriv ned dato og resultat her.
- [ ] Filer ligger i databasen (`stored_file`) og følger med. Brukes Vercel Blob, har den ingen egen
      sikkerhetskopi.

### 7. Overvåking og varsling

- [ ] Oppetidsmåler (f.eks. UptimeRobot eller Better Stack, gratis) mot `https://visplatform.no` og
      `https://visplatform.no/api/v1`, med varsel på e-post eller SMS.
- [ ] Render → *Notifications*: varsel når en deploy feiler eller tjenesten krasjer.
- [ ] Se på feilloggen under `/admin?fane=system` jevnlig. Søk i Render-loggen etter `auth.throttled`
      (mange treff = noen prøver å gjette passord).

### 8. GitHub

- [ ] *Settings* → *Code security* → slå på **Private vulnerability reporting** (brukes i `SECURITY.md`),
      **Dependabot alerts** og **Secret scanning**.
- [ ] *Settings* → *Branches* → beskytt `main`: krev pull request og grønn CI før merge.
- [ ] Fjern tilgang for folk som ikke trenger den.

### 9. Leverandører

- [ ] Render: to-trinns innlogging på kontoen, og bare de som trenger det har tilgang.
- [ ] Neon, Brevo, Stripe, GitHub, Google Cloud: to-trinns innlogging overalt.
- [ ] Stripe: bruk en *restricted key* med bare de tilgangene `lib/stripe.ts` trenger, og `sk_live_` først
      når alt er testet. Webhooken peker til `https://visplatform.no/api/stripe/webhook`.
- [ ] GitHub- og Google-innlogging: egne OAuth-apper for produksjon, med bare
      `https://visplatform.no/api/auth/callback/...` som tilbakekallsadresse.
- [ ] `CRON_SECRET` satt, og cron-jobbene kaller `/api/cron/ukesoppsummering` og `/api/cron/daglig`
      (den daglige sletter gamle søknader og CV-utkast).

## Etter hver deploy

- [ ] `/admin?fane=system`: ingen «Må fikses».
- [ ] Åpne forsiden, en profil, et prosjekt med video, CV-redigering (last opp en PDF) og `/admin` med
      utviklerverktøyene åpne. Konsollen skal ikke vise «Content-Security-Policy»-feil. Gjør den det, legg til
      kilden i `lib/csp.ts` (eller fjern den), test og deploy på nytt.
- [ ] Logg inn, logg ut, og logg inn med to-trinns innlogging.

## Allerede gjort i koden (2026-10-08)

Se [GJENNOMGANG-2026-10.md](GJENNOMGANG-2026-10.md) for detaljer.

- Next.js 16.3.8 (lukker kjent fjernkjøring av kode i `next/og` og SSRF i bildeoptimalisering) og sharp 0.35.5.
- Better Auth sine admin-endepunkter stengt, admin krever bekreftet e-post og to-trinns innlogging.
- Grenser per konto og e-postadresse, felles IP-logikk med `TRUSTED_IP_HEADER`.
- CV-dokumenter er skjult som standard og ligger alltid i databasen.
- Content-Security-Policy, «Logg ut på andre enheter», sletting av CV-importutkast.
- `npm audit` i CI stopper på høye og kritiske sårbarheter.
