// Legger inn eksempelbrukere med prosjekter, CV, følgere, reaksjoner og kommentarer,
// så det finnes noe å se på lokalt. Kjøres med: npm run db:seed
// Alle eksempelbrukerne har passordet «passord123». Kan kjøres flere ganger.
import { and, eq, sql } from "drizzle-orm";

type DemoProject = {
  title: string;
  summary: string;
  tags: string[];
  date: string;
  role?: string;
  images: { template: "dashboard" | "mobile" | "landing" | "map" | "editor"; palette: string }[];
  demoUrl?: string;
  repoUrl?: string;
  pinned?: boolean;
  daysAgo: number;
  about: string;
};

type DemoUser = {
  username: string;
  name: string;
  email: string;
  headline: string;
  location: string;
  bio: string;
  readme?: string;
  lookingFor?: string;
  openTo: ("jobb" | "freelance" | "samarbeid" | "mentor" | "prat")[];
  accent: "is" | "fjord" | "mose" | "nordlys" | "molte" | "rose";
  avatar?: [string, string];
  links: { label: string; url: string }[];
  skills: string[];
  experience: { title: string; organization: string; location?: string; startDate: string; endDate: string | null; description?: string }[];
  education: { institution: string; degree?: string; fieldOfStudy?: string; startDate: string; endDate: string | null }[];
  projects: DemoProject[];
};

const readme = (what: string, role: string, stack: string, learned: string) => `## Hva det er

${what}

## Min rolle

${role}

## Teknologi

${stack}

## Hva jeg lærte

${learned}
`;

const USERS: DemoUser[] = [
  {
    username: "ingrid",
    name: "Ingrid Solberg",
    email: "ingrid@eksempel.no",
    headline: "Produktdesigner som liker rolige grensesnitt",
    location: "Bergen",
    bio: "Designer med fem år i produktteam. Jeg jobber mest med designsystemer, tilgjengelighet og apper folk bruker hver dag.",
    readme: "Jeg tror de beste produktene føles *enkle*, selv når de ikke er det under panseret.\n\n- Designsystemer og komponentbibliotek\n- Universell utforming (WCAG 2.2)\n- Prototyper i Figma og React",
    lookingFor: "Et produktteam i Bergen eller remote, gjerne i offentlig sektor eller klima.",
    openTo: ["jobb", "samarbeid"],
    accent: "rose",
    avatar: ["#ff9fb5", "#b9a6ff"],
    links: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/eksempel" },
      { label: "Dribbble", url: "https://dribbble.com/eksempel" },
    ],
    skills: ["Figma", "Designsystemer", "Brukertesting", "React", "Universell utforming", "Prototyping"],
    experience: [
      { title: "Senior produktdesigner", organization: "Fjordkraft Digital", location: "Bergen", startDate: "2023-03", endDate: null, description: "Ansvar for designsystemet og appen til 400 000 kunder.\nLedet overgangen til WCAG 2.2." },
      { title: "Interaksjonsdesigner", organization: "Knowit", location: "Bergen", startDate: "2020-08", endDate: "2023-02" },
    ],
    education: [{ institution: "Universitetet i Bergen", degree: "Master", fieldOfStudy: "Informasjonsvitenskap", startDate: "2018", endDate: "2020" }],
    projects: [
      {
        title: "Fjellvær",
        summary: "Værappen for folk som går i fjellet – varsler om vind, sikt og snøras.",
        tags: ["Figma", "React Native", "Expo"],
        date: "2026-06",
        role: "Design og prototype",
        images: [{ template: "mobile", palette: "nordlys" }, { template: "landing", palette: "nordlys" }],
        demoUrl: "https://fjellvaer.example.com",
        pinned: true,
        daysAgo: 3,
        about: readme(
          "En værapp laget sammen med frivillige i Røde Kors Hjelpekorps. Den samler varsler fra Yr og Varsom på ett sted, med tydelige farger for fare.",
          "Jeg gjorde brukerintervjuer med 14 fjellfolk, tegnet flytene i Figma og bygde en klikkbar prototype i Expo.",
          "Figma, React Native, Expo, Yr sitt API og Varsom sitt API.",
          "At færre valg gir tryggere beslutninger. Den første versjonen hadde 11 skjermer – den som ble testet hadde 4.",
        ),
      },
      {
        title: "Designsystem for Bergen kommune",
        summary: "Komponentbibliotek med tokens, dokumentasjon og tilgjengelighet innebygd.",
        tags: ["Designsystemer", "Figma", "React", "Storybook"],
        date: "2025-11",
        role: "Designansvarlig",
        images: [{ template: "dashboard", palette: "is" }],
        pinned: true,
        daysAgo: 40,
        about: readme(
          "Et felles designsystem for 30 tjenester. Tokens i Figma synkroniseres automatisk til kode.",
          "Designansvarlig i et team på fem. Jeg eide komponentene, dokumentasjonen og tilgjengelighetsarbeidet.",
          "Figma Tokens, React, Storybook, Chromatic.",
          "Dokumentasjon er et produkt i seg selv. Vi målte bruken og skrev om de mest besøkte sidene tre ganger.",
        ),
      },
      {
        title: "Kaffekart",
        summary: "Et håndtegnet kart over de beste kaffebarene i Bergen sentrum.",
        tags: ["Illustrasjon", "Mapbox", "Svelte"],
        date: "2025-04",
        images: [{ template: "map", palette: "molte" }],
        daysAgo: 58,
        about: "Et lite sideprosjekt: alle kaffebarene jeg liker, tegnet inn på et kart med egne ikoner.\n\nLaget i Svelte med Mapbox og egne illustrasjoner fra Procreate.",
      },
    ],
  },
  {
    username: "jonasberg",
    name: "Jonas Berg",
    email: "jonas@eksempel.no",
    headline: "Fullstack-utvikler · TypeScript, Postgres og god kaffe",
    location: "Trondheim",
    bio: "Bygger nettløsninger fra database til knapp. Tar gjerne frilansoppdrag for små bedrifter og organisasjoner.",
    readme: "### Det jeg liker å jobbe med\n\n- Next.js og React Server Components\n- Postgres og gode datamodeller\n- Små, raske team\n\n```ts\nconst favoritt = \"det som faktisk blir brukt\";\n```",
    lookingFor: "Frilansoppdrag fra høsten 2026.",
    openTo: ["freelance", "prat"],
    accent: "molte",
    links: [
      { label: "GitHub", url: "https://github.com/eksempel" },
      { label: "Nettside", url: "https://jonasberg.example.com" },
    ],
    skills: ["TypeScript", "Next.js", "PostgreSQL", "Node.js", "Docker", "Tailwind CSS"],
    experience: [
      { title: "Fullstack-utvikler", organization: "Selvstendig", location: "Trondheim", startDate: "2024-01", endDate: null },
      { title: "Utvikler", organization: "Kantega", location: "Trondheim", startDate: "2021-08", endDate: "2023-12", description: "Nettløsninger for offentlig sektor.\nFrontendansvar i to prosjekter." },
    ],
    education: [{ institution: "NTNU", degree: "Bachelor", fieldOfStudy: "Informatikk", startDate: "2018", endDate: "2021" }],
    projects: [
      {
        title: "Studentbolig-portal",
        summary: "Søk, bytt og meld feil i studentboligen – for 8 000 studenter i Trondheim.",
        tags: ["Next.js", "TypeScript", "PostgreSQL", "Tailwind CSS"],
        date: "2026-05",
        role: "Fullstack",
        images: [{ template: "dashboard", palette: "fjord" }, { template: "mobile", palette: "fjord" }],
        repoUrl: "https://github.com/eksempel/studentbolig",
        demoUrl: "https://bolig.example.com",
        pinned: true,
        daysAgo: 1,
        about: readme(
          "Portalen erstatter tre gamle systemer. Studentene kan søke bolig, bytte rom og melde feil på ett sted.",
          "Jeg bygde det meste av frontenden og API-et, og satte opp databasen og deploy.",
          "Next.js 16, TypeScript, PostgreSQL, Drizzle, Tailwind CSS.",
          "At en god datamodell sparer deg for hundre if-setninger senere.",
        ),
      },
      {
        title: "Kodekveld",
        summary: "Oppgaver og automatisk retting for kodekveldene på skolen.",
        tags: ["TypeScript", "Docker", "Node.js"],
        date: "2025-09",
        images: [{ template: "editor", palette: "fjord" }],
        repoUrl: "https://github.com/eksempel/kodekveld",
        daysAgo: 20,
        about: "Frivillig prosjekt for Lær Kidsa Koding. Oppgavene rettes automatisk i Docker-containere, så barna får tilbakemelding med en gang.",
      },
      {
        title: "Ruteplan",
        summary: "Finn raskeste vei mellom campusene med buss, sykkel og gange.",
        tags: ["React", "Leaflet", "Entur"],
        date: "2024-11",
        images: [{ template: "map", palette: "is" }],
        daysAgo: 55,
        about: "Bruker Entur sitt åpne API for kollektivdata. Laget på en hackathon og videreutviklet etterpå.",
      },
    ],
  },
  {
    username: "amina",
    name: "Amina Hassan",
    email: "amina@eksempel.no",
    headline: "Maskinlæringsingeniør – data som hjelper folk",
    location: "Oslo",
    bio: "Jobber med maskinlæring i energisektoren. Brenner for åpne data og forklarbar KI.",
    openTo: ["mentor", "prat"],
    accent: "mose",
    avatar: ["#9fe0a8", "#3fb6a8"],
    links: [{ label: "GitHub", url: "https://github.com/eksempel" }],
    skills: ["Python", "PyTorch", "pandas", "SQL", "MLOps", "Statistikk"],
    experience: [{ title: "ML-ingeniør", organization: "Statnett", location: "Oslo", startDate: "2022-09", endDate: null, description: "Prognoser for strømforbruk.\nDrift av modeller i produksjon." }],
    education: [{ institution: "Universitetet i Oslo", degree: "Master", fieldOfStudy: "Data science", startDate: "2020", endDate: "2022" }],
    projects: [
      {
        title: "Strømpris-varsler",
        summary: "Varsler deg når strømmen er billigst, med prognoser for neste døgn.",
        tags: ["Python", "PyTorch", "FastAPI", "React"],
        date: "2026-04",
        role: "Modell og API",
        images: [{ template: "dashboard", palette: "mose" }],
        demoUrl: "https://strom.example.com",
        pinned: true,
        daysAgo: 6,
        about: readme(
          "En tjeneste som spår strømprisen time for time og sender varsel når det lønner seg å lade bilen eller vaske klær.",
          "Jeg laget modellen, API-et og infrastrukturen. En venn laget appen.",
          "Python, PyTorch, FastAPI, PostgreSQL og React.",
          "Enkle modeller slår ofte store når dataene er gode. Den første versjonen var lineær regresjon – og overraskende god.",
        ),
      },
      {
        title: "Klarspråk-sjekk",
        summary: "Finner tunge setninger i offentlige tekster og foreslår enklere ord.",
        tags: ["Python", "NLP", "Hugging Face"],
        date: "2025-10",
        images: [{ template: "editor", palette: "mose" }],
        repoUrl: "https://github.com/eksempel/klarsprak",
        daysAgo: 25,
        about: "Et verktøy som markerer lange setninger, passiv og fremmedord i norske tekster. Trent på åpne data fra Språkrådet.",
      },
    ],
  },
  {
    username: "sandern",
    name: "Sander Nilsen",
    email: "sander@eksempel.no",
    headline: "iOS-utvikler med sans for animasjoner",
    location: "Stavanger",
    bio: "Lager apper i SwiftUI. Glad i små detaljer som gjør at en app føles levende.",
    openTo: ["jobb"],
    accent: "fjord",
    links: [{ label: "App Store", url: "https://apps.apple.com" }],
    skills: ["Swift", "SwiftUI", "Core Data", "Figma"],
    experience: [{ title: "iOS-utvikler", organization: "Kolumbus", location: "Stavanger", startDate: "2023-01", endDate: null }],
    education: [{ institution: "Universitetet i Stavanger", degree: "Bachelor", fieldOfStudy: "Datateknologi", startDate: "2019", endDate: "2022" }],
    projects: [
      {
        title: "Løpeklubb",
        summary: "Planlegg fellesløp, del ruter og hold motivasjonen oppe sammen.",
        tags: ["Swift", "SwiftUI", "MapKit"],
        date: "2026-03",
        images: [{ template: "mobile", palette: "fjord" }, { template: "map", palette: "fjord" }],
        pinned: true,
        daysAgo: 9,
        about: "Laget for løpeklubben min. Over 200 medlemmer bruker den hver uke. Ruter tegnes rett i kartet og deles med én lenke.",
      },
      {
        title: "Matboks",
        summary: "Handleliste som lærer hva du pleier å kjøpe.",
        tags: ["Swift", "Core Data"],
        date: "2025-06",
        images: [{ template: "mobile", palette: "molte" }],
        daysAgo: 45,
        about: "Et sideprosjekt for å lære Core Data og widgets. Foreslår varer basert på hva du har kjøpt før.",
      },
    ],
  },
  {
    username: "thealie",
    name: "Thea Lie",
    email: "thea@eksempel.no",
    headline: "Frontend og kreativ koding – WebGL, shaders og typografi",
    location: "Oslo",
    bio: "Frontendutvikler i et byrå. På fritiden lager jeg generativ kunst og små eksperimenter i nettleseren.",
    readme: "Jeg lager ting som *beveger seg*. Mest i WebGL og Three.js, noen ganger bare med CSS.",
    openTo: ["freelance", "samarbeid"],
    accent: "nordlys",
    avatar: ["#b9a6ff", "#6f8cff"],
    links: [
      { label: "Instagram", url: "https://instagram.com/eksempel" },
      { label: "Nettside", url: "https://thea.example.com" },
    ],
    skills: ["JavaScript", "Three.js", "WebGL", "GSAP", "React", "Blender"],
    experience: [{ title: "Frontendutvikler", organization: "Bekk", location: "Oslo", startDate: "2022-01", endDate: null }],
    education: [{ institution: "Høyskolen Kristiania", degree: "Bachelor", fieldOfStudy: "Interaktivt design", startDate: "2018", endDate: "2021" }],
    projects: [
      {
        title: "Nordlys-generator",
        summary: "Generativt nordlys i sanntid, laget med shaders.",
        tags: ["WebGL", "Three.js", "GLSL"],
        date: "2026-01",
        images: [{ template: "landing", palette: "nordlys" }],
        demoUrl: "https://nordlys.example.com",
        pinned: true,
        daysAgo: 2,
        about: "Et eksperiment med støyfunksjoner i GLSL. Fargene følger ekte målinger av solvind fra NOAA.\n\nKjører i 60 fps på mobil.",
      },
      {
        title: "Portfolio 2026",
        summary: "Min egen portefølje, med scroll-animasjoner og variabel typografi.",
        tags: ["React", "GSAP", "Figma"],
        date: "2025-12",
        images: [{ template: "landing", palette: "papir" }],
        daysAgo: 14,
        about: "Designet og bygget på tre helger. Fikk honorable mention på Awwwards.",
      },
    ],
  },
  {
    username: "mats.eriksen",
    name: "Mats Eriksen",
    email: "mats@eksempel.no",
    headline: "Backend og DevOps nord for polarsirkelen",
    location: "Tromsø",
    bio: "Liker systemer som bare fungerer. Jobber med skyplattform, overvåking og API-er.",
    openTo: ["prat"],
    accent: "is",
    links: [{ label: "GitHub", url: "https://github.com/eksempel" }],
    skills: ["Go", "Kubernetes", "Terraform", "PostgreSQL", "Grafana"],
    experience: [{ title: "Plattformutvikler", organization: "Kongsberg Satellite Services", location: "Tromsø", startDate: "2021-06", endDate: null }],
    education: [{ institution: "UiT Norges arktiske universitet", degree: "Master", fieldOfStudy: "Informatikk", startDate: "2016", endDate: "2021" }],
    projects: [
      {
        title: "Deploy-bot",
        summary: "Slack-bot som deployer, ruller tilbake og forklarer hva som skjedde.",
        tags: ["Go", "Kubernetes", "Slack"],
        date: "2026-02",
        images: [{ template: "editor", palette: "is" }],
        repoUrl: "https://github.com/eksempel/deploy-bot",
        daysAgo: 11,
        about: "Laget for å gjøre deploy kjedelig. Brukes av fire team.",
      },
      {
        title: "Fjordtracker API",
        summary: "Åpent API for havtemperatur og strøm i norske fjorder.",
        tags: ["Go", "PostgreSQL", "Grafana"],
        date: "2025-08",
        images: [{ template: "dashboard", palette: "fjord" }],
        daysAgo: 33,
        about: "Samler målinger fra åpne bøyer og gjør dem tilgjengelige som et enkelt REST-API.",
      },
    ],
  },
  {
    username: "sarajohansen",
    name: "Sara Johansen",
    email: "sara@eksempel.no",
    headline: "UX-student på NTNU – ser etter sommerjobb",
    location: "Gjøvik",
    bio: "Tredjeårsstudent i interaksjonsdesign. Glad i brukertesting og å gjøre komplekse ting forståelige.",
    lookingFor: "Sommerjobb 2027 i et produktteam.",
    openTo: ["jobb", "mentor"],
    accent: "molte",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/eksempel" }],
    skills: ["Figma", "Brukertesting", "Prototyping", "HTML", "CSS"],
    experience: [{ title: "Studentassistent", organization: "NTNU", location: "Gjøvik", startDate: "2025-08", endDate: null }],
    education: [{ institution: "NTNU", degree: "Bachelor", fieldOfStudy: "Interaksjonsdesign", startDate: "2024", endDate: null }],
    projects: [
      {
        title: "Bibliotek-appen",
        summary: "Redesign av lånekortet og reservasjoner for folkebiblioteket.",
        tags: ["Figma", "Brukertesting"],
        date: "2026-05",
        role: "UX og prototype",
        images: [{ template: "mobile", palette: "papir" }],
        pinned: true,
        daysAgo: 4,
        about: readme(
          "Et skoleprosjekt der vi redesignet biblioteksappen sammen med ansatte og lånere.",
          "Jeg ledet brukertestene og laget prototypen i Figma.",
          "Figma, Maze og mange post-it-lapper.",
          "At eldre brukere ikke trenger enklere apper – de trenger tydeligere apper.",
        ),
      },
    ],
  },
];

const COMMENTS = [
  "Så rent og fint! Hvordan løste dere tilgjengeligheten i de mørke fargene?",
  "Dette hadde jeg brukt hver dag. Er koden åpen?",
  "Elsker detaljene i animasjonene. Hvilket bibliotek brukte du?",
  "Veldig god README, lett å forstå hva prosjektet gjør 👏",
  "Har du tenkt på å legge til mørk modus?",
  "Imponerende at dette ble laget på så kort tid.",
];

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  if (process.env.NODE_ENV === "production") throw new Error("Seed skal bare kjøres lokalt.");

  const { db, schema } = await import("@/db");
  const { auth } = await import("@/lib/auth");
  const { addProjectImages, createProject } = await import("@/lib/projects");
  const { saveCv } = await import("@/lib/cv");
  const { updateProfile } = await import("@/lib/profiles");
  const { projectInput, profileInput } = await import("@/lib/validation");
  const { storeImage } = await import("@/lib/storage");
  const { avatarImage, projectImage } = await import("./seed-images");

  const file = (bytes: Buffer, name: string) => new File([new Uint8Array(bytes)], name, { type: "image/webp" });
  const ids = new Map<string, string>();
  const created = new Set<string>();

  async function ensureUser(username: string, name: string, email: string) {
    const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.username, username));
    if (existing) return existing.id;
    const { user } = await auth.api.signUpEmail({ body: { name, email, password: "passord123", username } });
    created.add(username);
    return user.id;
  }

  // Den gamle eksempelbrukeren fra før.
  const aryanId = await ensureUser("aryan", "Aryan Ali", "aryan@eksempel.no");
  ids.set("aryan", aryanId);
  if (created.has("aryan")) {
    await updateProfile(
      aryanId,
      profileInput.parse({
        name: "Aryan Ali",
        headline: "Informatikkstudent i Oslo",
        bio: "Computer science student in Oslo. Building mobile and web applications with React Native, Next.js and Kotlin.",
        location: "Oslo",
        links: [{ label: "GitHub", url: "https://github.com/aryanma05" }],
      }),
    );
    for (const p of [
      { title: "Booking App", summary: "A mobile app for booking appointments.", tags: ["React Native", "Expo", "TypeScript"], projectDate: "2025-02", description: "A mobile application for booking appointments with local businesses. Users can browse availability, make a booking, cancel appointments and receive reminders." },
      { title: "Weather Map", summary: "A web app that shows weather data on an interactive map.", tags: ["Next.js", "TypeScript", "Leaflet"], projectDate: "2024-10", description: "A web application that retrieves weather information from an API and displays it on an interactive map." },
      { title: "Task App", summary: "A simple Android task manager built with Kotlin.", tags: ["Kotlin", "Jetpack Compose", "Android"], projectDate: "2024-04", description: "A simple Android task manager built with Kotlin and Jetpack Compose." },
    ]) {
      await createProject(aryanId, projectInput.parse(p));
    }
    await saveCv(aryanId, {
      experience: [],
      education: [{ institution: "Universitetet i Oslo", degree: "Bachelor", fieldOfStudy: "Informatikk", startDate: "2023", endDate: null, description: null }],
      skills: ["TypeScript", "React Native", "Next.js", "Kotlin"],
    });
  }

  // Prosjektene til @aryan fikk ingen bilder i den første versjonen av seeden.
  const aryanProjects = await db
    .select({ id: schema.project.id, title: schema.project.title, images: sql<number>`(select count(*)::int from ${schema.projectImage} where ${schema.projectImage.projectId} = ${schema.project.id})` })
    .from(schema.project)
    .where(eq(schema.project.ownerId, aryanId));
  const aryanLooks = [
    { template: "mobile", palette: "is" },
    { template: "map", palette: "fjord" },
    { template: "mobile", palette: "mose" },
  ] as const;
  for (const [i, p] of aryanProjects.entries()) {
    if (p.images > 0) continue;
    const look = aryanLooks[i % aryanLooks.length];
    await addProjectImages(aryanId, p.id, [file(await projectImage(look.template, p.title, look.palette, i + 3), "cover.webp")]);
  }

  for (const u of USERS) {
    const id = await ensureUser(u.username, u.name, u.email);
    ids.set(u.username, id);
    if (!created.has(u.username)) continue;

    await updateProfile(
      id,
      profileInput.parse({
        name: u.name,
        headline: u.headline,
        bio: u.bio,
        location: u.location,
        links: u.links,
        readme: u.readme ?? null,
        lookingFor: u.lookingFor ?? null,
        openTo: u.openTo,
        accentColor: u.accent,
        customSections: [],
      }),
    );

    if (u.avatar) {
      const stored = await storeImage(file(await avatarImage(u.avatar[0], u.avatar[1], u.username.length * 7), "avatar.webp"), `avatars/${id}`, { ownerId: id });
      await db.update(schema.user).set({ image: stored.url }).where(eq(schema.user.id, id));
    }

    await saveCv(id, {
      experience: u.experience.map((e) => ({ ...e, location: e.location ?? null, description: e.description ?? null })),
      education: u.education.map((e) => ({ ...e, degree: e.degree ?? null, fieldOfStudy: e.fieldOfStudy ?? null, description: null })),
      skills: u.skills,
    });

    for (const [pi, p] of u.projects.entries()) {
      const projectId = await createProject(
        id,
        projectInput.parse({
          title: p.title,
          summary: p.summary,
          description: p.about,
          tags: p.tags,
          projectDate: p.date,
          role: p.role ?? null,
          demoUrl: p.demoUrl ?? null,
          repoUrl: p.repoUrl ?? null,
          status: "published",
        }),
      );
      const images = await Promise.all(
        p.images.map(async (img, i) => file(await projectImage(img.template, p.title, img.palette as never, pi * 31 + i * 7 + u.username.length), `bilde-${i + 1}.webp`)),
      );
      await addProjectImages(id, projectId, images);
      const when = new Date(Date.now() - p.daysAgo * 86_400_000 - pi * 3_600_000);
      await db
        .update(schema.project)
        .set({ publishedAt: when, createdAt: when, pinned: Boolean(p.pinned) })
        .where(eq(schema.project.id, projectId));
    }
  }

  // Bekreftede e-poster og admin-rolle, så man kan logge inn med én gang.
  await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(sql`${schema.user.email} like '%@eksempel.no'`);
  await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.username, "aryan"));

  if (created.size === 0) {
    console.log("Eksempeldataene finnes allerede. Logg inn som f.eks. @ingrid eller @aryan med passordet passord123.");
    process.exit(0);
  }

  // Følgere, reaksjoner, kommentarer og visninger mellom eksempelbrukerne.
  const usernames = [...ids.keys()];
  const allProjects = await db
    .select({ id: schema.project.id, ownerId: schema.project.ownerId })
    .from(schema.project)
    .innerJoin(schema.user, eq(schema.user.id, schema.project.ownerId))
    .where(and(eq(schema.project.status, "published"), sql`${schema.user.email} like '%@eksempel.no'`));

  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (const a of usernames) {
    for (const b of usernames) {
      if (a === b || random() > 0.55) continue;
      await db.insert(schema.follow).values({ followerId: ids.get(a)!, followingId: ids.get(b)! }).onConflictDoNothing();
    }
  }

  const types = ["like", "useful", "inspiring"] as const;
  for (const project of allProjects) {
    for (const u of usernames) {
      const userId = ids.get(u)!;
      if (userId === project.ownerId) continue;
      for (const type of types) {
        if (random() < (type === "like" ? 0.55 : 0.2)) {
          await db.insert(schema.reaction).values({ projectId: project.id, userId, type }).onConflictDoNothing();
        }
      }
    }

    const commenters = usernames.map((u) => ids.get(u)!).filter((id) => id !== project.ownerId && random() < 0.3);
    let parentId: string | null = null;
    for (const [i, authorId] of commenters.slice(0, 3).entries()) {
      const [c] = await db
        .insert(schema.comment)
        .values({ projectId: project.id, authorId, body: COMMENTS[Math.floor(random() * COMMENTS.length)], createdAt: new Date(Date.now() - (i + 1) * 7_200_000) })
        .returning({ id: schema.comment.id });
      if (i === 0) parentId = c.id;
    }
    if (parentId) {
      await db.insert(schema.comment).values({ projectId: project.id, authorId: project.ownerId, parentId, body: "Tusen takk! Det skal jeg skrive mer om i README-en snart." });
    }

    let total = 0;
    for (let d = 0; d < 30; d++) {
      const views = Math.floor(random() * (d < 7 ? 40 : 15));
      if (views === 0) continue;
      total += views;
      await db
        .insert(schema.projectViewDay)
        .values({ projectId: project.id, day: sql`current_date - ${d}::int`, views })
        .onConflictDoNothing();
    }
    await db.update(schema.project).set({ viewCount: total }).where(eq(schema.project.id, project.id));
  }

  for (const u of usernames) {
    for (let d = 0; d < 30; d++) {
      const views = Math.floor(random() * 25);
      if (views === 0) continue;
      await db.insert(schema.profileViewDay).values({ userId: ids.get(u)!, day: sql`current_date - ${d}::int`, views }).onConflictDoNothing();
    }
  }

  console.log(`Laget ${created.size} eksempelbrukere med prosjekter. Logg inn som f.eks. @ingrid eller @aryan (admin) med passordet passord123.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
