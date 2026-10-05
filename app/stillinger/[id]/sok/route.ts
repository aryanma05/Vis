import { applyTarget } from "@/lib/jobs";

// «Søk på stillingen»: teller klikket og sender videre til søknadslenken eller e-posten.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = await applyTarget(id);
  if (!target) return Response.redirect(new URL(`/stillinger/${id}`, request.url), 303);
  return new Response(null, { status: 303, headers: { Location: target, "Cache-Control": "no-store" } });
}
