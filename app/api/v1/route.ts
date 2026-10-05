import { preflight } from "@/lib/api";
import { siteUrl } from "@/lib/site";

export const OPTIONS = preflight;

// Oversikt over API-et. Dokumentasjonen ligger på /utviklere.
export function GET() {
  const base = `${siteUrl()}/api/v1`;
  return Response.json(
    {
      version: "1",
      docs: `${siteUrl()}/utviklere`,
      endpoints: {
        profile: `${base}/profiles/{username}`,
        profileProjects: `${base}/profiles/{username}/projects`,
        projects: `${base}/projects?q=&tag=&featured=&limit=`,
        project: `${base}/projects/{id}`,
        jobs: `${base}/jobs?q=&type=&remote=&limit=`,
        job: `${base}/jobs/{id}`,
        company: `${base}/companies/{slug}`,
      },
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
