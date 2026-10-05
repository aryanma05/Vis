import { preflight, withApi } from "@/lib/api";
import { apiProject } from "@/lib/api-v1";

export const OPTIONS = preflight;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApi(request, () => apiProject(id));
}
