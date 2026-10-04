import { intParam, preflight, withApi } from "@/lib/api";
import { apiJobs } from "@/lib/api-v1";

export const OPTIONS = preflight;

// ?q=react&type=fulltid&remote=hybrid&limit=24
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return withApi(request, () => apiJobs(params, intParam(params.get("limit"), 24, 60)));
}
