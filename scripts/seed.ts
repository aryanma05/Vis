// Legger inn en eksempelbruker med prosjekter (samme data som de gamle mock-sidene),
// så forsiden sin «Se eksempelprofil»-lenke fungerer lokalt. Kjøres med: npm run db:seed
import { eq } from "drizzle-orm";

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}

  if (process.env.NODE_ENV === "production") throw new Error("Seed skal bare kjøres lokalt.");

  const { db, schema } = await import("@/db");
  const { auth } = await import("@/lib/auth");
  const { createProject } = await import("@/lib/projects");
  const { saveCv } = await import("@/lib/cv");
  const { updateProfile } = await import("@/lib/profiles");
  const { projectInput, profileInput } = await import("@/lib/validation");

  const [existing] = await db.select().from(schema.user).where(eq(schema.user.username, "aryan"));
  if (existing) {
    console.log("Eksempelbrukeren @aryan finnes allerede.");
    process.exit(0);
  }

  const { user } = await auth.api.signUpEmail({
    body: { name: "Aryan Ali", email: "aryan@eksempel.no", password: "passord123", username: "aryan" },
  });

  await updateProfile(
    user.id,
    profileInput.parse({
      name: "Aryan Ali",
      headline: "Informatikkstudent i Oslo",
      bio: "Computer science student in Oslo. Building mobile and web applications with React Native, Next.js and Kotlin.",
      location: "Oslo",
      links: [{ label: "GitHub", url: "https://github.com/aryanma05" }],
    }),
  );

  const projects = [
    {
      title: "Booking App",
      summary: "A mobile app for booking appointments.",
      description:
        "A mobile application for booking appointments with local businesses. Users can browse availability, make a booking, cancel appointments and receive reminders.",
      tags: ["React Native", "Expo", "TypeScript"],
      projectDate: "2025-02",
    },
    {
      title: "Weather Map",
      summary: "A web app that shows weather data on an interactive map.",
      description:
        "A web application that retrieves weather information from an API and displays it on an interactive map. Users can search for locations and view a forecast.",
      tags: ["Next.js", "TypeScript", "Leaflet"],
      projectDate: "2024-10",
    },
    {
      title: "Task App",
      summary: "A simple Android task manager built with Kotlin.",
      description:
        "A simple Android task manager built with Kotlin and Jetpack Compose. It supports tasks, categories and local storage.",
      tags: ["Kotlin", "Jetpack Compose", "Android"],
      projectDate: "2024-04",
    },
  ];

  for (const p of projects) await createProject(user.id, projectInput.parse(p));

  await saveCv(user.id, {
    experience: [],
    education: [
      {
        institution: "Universitetet i Oslo",
        degree: "Bachelor",
        fieldOfStudy: "Informatikk",
        startDate: "2023",
        endDate: null,
        description: null,
      },
    ],
    skills: ["TypeScript", "React Native", "Next.js", "Kotlin"],
  });

  console.log("Laget @aryan (passord: passord123) med 3 prosjekter.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
