import { unsubscribeDigest, verifyUnsubscribe } from "@/lib/digest";

// Ett-klikks avmelding (RFC 8058) fra e-postprogrammets egen «Meld av»-knapp. Gmail og
// Apple Mail sender en POST hit med adressen fra List-Unsubscribe-headeren.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!u || !t || !verifyUnsubscribe(u, t)) return new Response(null, { status: 400 });
  await unsubscribeDigest(u);
  return new Response(null, { status: 204 });
}
