import Link from "next/link";

const mockUser = {
  username: "arian",
  fullName: "Aryan Ali",
  bio: "Computer science student in Oslo. Building mobile and web applications with React Native, Next.js and Kotlin.",
  location: "Oslo, Norway",
  projects: [
    {
      id: "1",
      title: "Booking App",
      description: "A mobile app for booking appointments.",
      technologies: ["React Native", "Expo", "TypeScript"],
    },
    {
      id: "2",
      title: "Weather Map",
      description: "A web app that shows weather data on an interactive map.",
      technologies: ["Next.js", "TypeScript", "Leaflet"],
    },
    {
      id: "3",
      title: "Task App",
      description: "A simple Android task manager built with Kotlin.",
      technologies: ["Kotlin", "Jetpack Compose", "Android"],
    },
  ],
};

export default function ProfilePage() {
  const user = mockUser;

  return (
    <main className="min-h-screen bg-[#071A52] text-white">
      <header className="border-b border-[#174B76] bg-[#071A52]/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            vis
          </Link>

          <Link
            href="/register"
            className="rounded-lg border border-[#174B76] px-4 py-2 text-sm font-medium text-[#C7F9FF] transition hover:border-[#C7F9FF] hover:bg-[#0A245E]"
          >
            Create profile
          </Link>
        </div>
      </header>

      <section className="border-b border-[#174B76]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <Link
            href="/"
            className="text-sm text-[#B8D8E3] transition hover:text-white"
          >
            ← Back to explore
          </Link>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#C7F9FF] text-3xl font-bold text-[#071A52]">
              AA
            </div>

            <div>
              <h1 className="text-3xl font-bold">{user.fullName}</h1>

              <p className="mt-1 text-[#C7F9FF]">@{user.username}</p>

              <p className="mt-2 text-sm text-[#B8D8E3]">{user.location}</p>

              <p className="mt-4 max-w-2xl leading-7 text-[#B8D8E3]">
                {user.bio}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-[#C7F9FF]">
              Portfolio
            </p>

            <h2 className="mt-2 text-2xl font-bold">Projects</h2>
          </div>

          <p className="text-sm text-[#B8D8E3]">
            {user.projects.length} projects
          </p>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {user.projects.map((project) => (
            <Link
              key={project.id}
              href={`/prosjekt/${project.id}`}
              className="group rounded-2xl border border-[#174B76] bg-[#0A245E] p-5 transition hover:-translate-y-1 hover:border-[#C7F9FF] hover:shadow-xl hover:shadow-black/20"
            >
              <h3 className="text-lg font-semibold transition group-hover:text-[#C7F9FF]">
                {project.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-[#B8D8E3]">
                {project.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {project.technologies.map((technology) => (
                  <span
                    key={technology}
                    className="rounded-full border border-[#174B76] bg-[#071A52] px-3 py-1 text-xs text-[#C7F9FF]"
                  >
                    {technology}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}