import { UserFacingError } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";
import { talentListCsv } from "@/lib/talent";

// Kandidatliste som CSV (semikolon, så Excel i Norge åpner den riktig).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Logg inn først", { status: 401 });
  const { id } = await params;
  try {
    const { name, csv } = await talentListCsv(user.id, id);
    const file = `${name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "kandidater"}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kandidater.csv"; filename*=UTF-8''${encodeURIComponent(file)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UserFacingError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
