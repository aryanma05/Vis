import { preflight, withApi } from "@/lib/api";
import { apiProfile } from "@/lib/api-v1";

export const OPTIONS = preflight;

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return withApi(request, () => apiProfile(username));
}
