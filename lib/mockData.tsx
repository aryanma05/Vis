export type MockProject = {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  repoUrl: string;
  demoUrl: string;
  owner: {
    username: string;
    fullName: string;
  };
};

export type MockProfile = {
  username: string;
  fullName: string;
  bio: string;
  location: string;
  projects: MockProject[];
};

export const mockProjects: MockProject[] = [
  {
    id: "1",
    title: "Booking App",
    description:
      "En mobilapplikasjon for å bestille avtaler hos lokale bedrifter. Brukere kan se tilgjengelighet, opprette bestillinger og avbestille avtaler.",
    technologies: ["React Native", "Expo", "TypeScript"],
    repoUrl: "https://github.com/",
    demoUrl: "",
    owner: {
      username: "arian",
      fullName: "Aryan Ali",
    },
  },
  {
    id: "2",
    title: "Weather Map",
    description:
      "En webapplikasjon som henter værdata fra et API og viser informasjonen på et interaktivt kart.",
    technologies: ["Next.js", "TypeScript", "Leaflet"],
    repoUrl: "https://github.com/",
    demoUrl: "",
    owner: {
      username: "arian",
      fullName: "Aryan Ali",
    },
  },
  {
    id: "3",
    title: "Task App",
    description:
      "En enkel Android-oppgaveapp bygget med Kotlin og Jetpack Compose. Appen støtter oppgaver, kategorier og lokal lagring.",
    technologies: ["Kotlin", "Jetpack Compose", "Android"],
    repoUrl: "https://github.com/",
    demoUrl: "",
    owner: {
      username: "arian",
      fullName: "Aryan Ali",
    },
  },
];

export const mockProfiles: MockProfile[] = [
  {
    username: "arian",
    fullName: "Aryan Ali",
    bio: "Computer science student in Oslo. Building mobile and web applications with React Native, Next.js and Kotlin.",
    location: "Oslo, Norway",
    projects: mockProjects,
  },
];

export function getMockProject(id: string) {
  return mockProjects.find((project) => project.id === id) ?? null;
}

export function getMockProfile(username: string) {
  return (
    mockProfiles.find((profile) => profile.username === username) ?? null
  );
}