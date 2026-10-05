import { intParam, preflight, withApi } from "@/lib/api";
import { apiProjects } from "@/lib/api-v1";

export const OPTIONS = preflight;

// ?q=søk&tag=react&featured=true&limit=24
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return withApi(request, () => apiProjects(params, intParam(params.get("limit"), 24, 60)));
}
