import { preflight, withApi } from "@/lib/api";
import { apiCompany } from "@/lib/api-v1";

export const OPTIONS = preflight;

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withApi(request, () => apiCompany(slug));
}
