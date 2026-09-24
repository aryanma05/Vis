import { exportUserData } from "@/lib/account";
import { auth } from "@/lib/auth";

// Last ned alt vi har lagret om deg (lenke på kontosiden).
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Du må være logget inn.", { status: 401 });

  const data = await exportUserData(session.user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vis-mine-data-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
