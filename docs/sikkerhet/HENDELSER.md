# Når noe går galt

En enkel plan for sikkerhetshendelser: en konto er overtatt, en nøkkel har lekket, noen misbruker
tjenesten, eller personopplysninger kan ha kommet på avveie.

## 1. Stopp skaden

| Situasjon | Gjør dette |
| --- | --- |
| Én konto er overtatt eller misbrukes | `/admin` → Brukere → **Steng**. Sletter alle øktene til kontoen med en gang (virker fullt ut innen 5 minutter, se under) |
| Innhold må bort nå | `/admin` → «Fjern» på prosjektet, eller slett kommentaren |
| Noen spammer eller gjetter passord | Søk i Render-loggen etter `auth.throttled` og `rate`. Grensene i `lib/rate-limit.ts` (`RULES`) og `lib/auth.ts` kan strammes inn og deployes |
| En admin-konto kan være kompromittert | Fjern e-posten fra `ADMIN_EMAILS` og sett `role` til `user` i databasen. Logg ut alle økter for kontoen (under) |
| Alle må logges ut | Slett alle økter (under). Brukerne logger inn på nytt; ingenting annet går tapt |

Logge ut én bruker eller alle, i Neon sin SQL-editor (produksjon):

```sql
delete from session where user_id = '<bruker-id>';
```

```sql
delete from session;
```

Økten mellomlagres i en signert informasjonskapsel i opptil 5 minutter. Må det skje umiddelbart, roter
`BETTER_AUTH_SECRET` (under), som også gjør de mellomlagrede øktene ugyldige.

## 2. Bytt nøkler som kan ha lekket

Verdiene ligger hos Render (*Environment*). Bytt hos leverandøren først, så hos Render, og deploy.

| Nøkkel | Slik byttes den | Bivirkning |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon → *Roles* → *Reset password* | Ingen, etter ny deploy |
| `BETTER_AUTH_SECRET` | Lag en ny (`openssl rand -base64 32`) og sett `BETTER_AUTH_SECRETS="1:<ny>"`. **La `BETTER_AUTH_SECRET` stå med den gamle verdien** | Alle logges ut (øktene signeres med den nye). Den gamle trengs for å lese to-trinnshemmeligheter og GitHub-nøkler som ble kryptert før rotasjonen; fjernes den, slutter de å virke. Har den gamle lekket sammen med databasen, bør brukerne sette opp to-trinns innlogging på nytt |
| `BREVO_API_KEY` / `RESEND_API_KEY` | Lag ny nøkkel, slett den gamle | Ingen |
| `GITHUB_TOKEN` | github.com/settings/personal-access-tokens → slett og lag nytt | Ingen |
| `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET` | Ny hemmelighet i OAuth-appen | Ingen |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe → *Developers* → *API keys* → *Roll key*; webhooken → *Roll secret* | Ingen |
| `CRON_SECRET` | Ny verdi hos Render og i cron-tjenesten | Ingen |
| `BLOB_READ_WRITE_TOKEN` | Vercel → *Storage* → Blob → ny token | Ingen |

Brukernes API-nøkler kan de slette selv under Konto → Utviklere. Er alle i fare, slett radene i `api_key`.

## 3. Finn ut hva som skjedde

- Render → *Logs*: søk etter bruker-id, sti eller `admin.` (alle admin-handlinger logges).
- `/admin?fane=system`: feilloggen de siste 30 dagene.
- Bedrifter: aktivitetsloggen under bedriftens Administrer → Personvern og logg.
- Trenger du data slik de var før, lag en branch i Neon fra et tidspunkt før hendelsen og les derfra.
  Ikke gjenopprett over produksjon uten å ha sett på branchen først.

Skriv ned tidspunkter, hva som ble gjort og av hvem.

## 4. Personopplysninger på avveie

Kan personopplysninger ha blitt lest, endret eller slettet av noen som ikke skulle det, er det et brudd på
personopplysningssikkerheten (GDPR art. 33–34):

- Meld fra til **Datatilsynet innen 72 timer** etter at dere ble klar over det, med mindre det er
  usannsynlig at det medfører en risiko for personene (datatilsynet.no → «Meld avvik»).
- Ved høy risiko (f.eks. lekkede CV-er eller e-postadresser i stor skala) skal de berørte også få beskjed.
- Dokumenter alle avvik, også de som ikke meldes.

Hva som må meldes, og til hvem, bør vurderes av noen med juridisk kompetanse.

## 5. Etterpå

- Rett feilen, legg til en test som hadde fanget den, og deploy.
- Kreditér den som meldte fra, hvis de vil (se `SECURITY.md`).
- Oppdater denne planen hvis noe manglet.
