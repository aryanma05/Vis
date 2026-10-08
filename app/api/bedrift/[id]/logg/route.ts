import { auditCsv } from "@/lib/company-privacy";
import { UserFacingError } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";

// Aktivitetsloggen som CSV (Bedrift, eier og administratorer). Begrenset per bedrift, og
// nedlastingen logges selv. ?logg=tilgang|sokere|eksport|innstillinger gir bare den gruppen.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Logg inn først", { status: 401 });
  const { id } = await params;
  const group = new URL(request.url).searchParams.get("logg");
  try {
    const csv = await auditCsv(user.id, String(id), group);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aktivitetslogg-${date}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof UserFacingError) return new Response(error.message, { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    throw error;
  }
}
