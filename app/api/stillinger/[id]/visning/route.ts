import { countJobView } from "@/lib/jobs";
import { isBot } from "@/lib/views";

// Én visning per økt (nettleseren husker hvilke stillinger den har talt).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const { id } = await params;
  await countJobView(id).catch(() => {});
  return new Response(null, { status: 204 });
}
