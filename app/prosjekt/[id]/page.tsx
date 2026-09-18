import Link from "next/link";

const mockProjects = {
  "1": {
    id: "1",
    title: "Booking App",
    description:
      "A mobile application for booking appointments with local businesses. Users can browse availability, make a booking, cancel appointments and receive reminders.",
    technologies: ["React Native", "Expo", "TypeScript"],
    repoUrl: "https://github.com/",
    demoUrl: "#",
    owner: {
      username: "arian",
      fullName: "Aryan Ali",
    },
  },
  "2": {
    id: "2",
    title: "Weather Map",
    description:
      "A web application that retrieves weather information from an API and displays it on an interactive map. Users can search for locations and view a forecast.",
    technologies: ["Next.js", "TypeScript", "Leaflet"],
    repoUrl: "https://github.com/",
    demoUrl: "#",
    owner: {
      username: "arian",
      fullName: "Aryan Ali",
    },
  },
  "3": {
    id: "3",
    title: "Task App",
    description:
      "A simple Android task manager built with Kotlin and Jetpack Compose. It supports tasks, categories and local storage.",
    technologies: ["Kotlin", "Jetpack Compose", "Android"],
    repoUrl: "https://github.com/",
    demoUrl: "#",
    owner: {
      username: "arian",
      fullName: "Aryan Ali",
    },
  },
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = mockProjects[id as keyof typeof mockProjects];

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071A52] px-6 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Project not found</h1>

          <Link
            href="/"
            className="mt-4 inline-block text-[#C7F9FF] underline"
          >
            Back to vis
          </Link>
        </div>
      </main>
    );
  }

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

      <section className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href={`/profil/${project.owner.username}`}
          className="text-sm text-[#B8D8E3] transition hover:text-white"
        >
          ← Back to {project.owner.fullName}
        </Link>

        <p className="mt-10 text-sm font-medium uppercase tracking-widest text-[#C7F9FF]">
          Project
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          {project.title}
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#B8D8E3]">
          {project.description}
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {project.technologies.map((technology) => (
            <span
              key={technology}
              className="rounded-full border border-[#174B76] bg-[#0A245E] px-3 py-1.5 text-sm text-[#C7F9FF]"
            >
              {technology}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#C7F9FF] px-5 py-3 font-semibold text-[#071A52] transition hover:bg-white"
          >
            View GitHub
          </a>

          {project.demoUrl !== "#" && (
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[#174B76] bg-[#0A245E] px-5 py-3 font-semibold text-white transition hover:border-[#C7F9FF]"
            >
              View demo
            </a>
          )}
        </div>

        <div className="mt-14 rounded-2xl border border-[#174B76] bg-[#0A245E] p-6">
          <p className="text-sm font-medium text-[#C7F9FF]">Created by</p>

          <Link
            href={`/profil/${project.owner.username}`}
            className="mt-2 inline-block text-xl font-semibold transition hover:text-[#C7F9FF]"
          >
            {project.owner.fullName}
          </Link>

          <p className="mt-1 text-sm text-[#B8D8E3]">
            @{project.owner.username}
          </p>
        </div>
      </section>
    </main>
  );
}