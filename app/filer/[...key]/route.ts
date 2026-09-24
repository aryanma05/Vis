import { auth } from "@/lib/auth";
import { getStoredFile } from "@/lib/storage";

// Serverer bilder og CV-er som er lagret i databasen (se lib/storage.ts).
// Nøklene inneholder en tilfeldig UUID, så innholdet bak en URL endres aldri og kan
// caches lenge. Private filer (f.eks. en skjult CV) vises bare for eieren.
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const file = await getStoredFile(key.join("/"));
  const notFound = () => new Response("Fant ikke filen.", { status: 404 });
  if (!file) return notFound();

  if (file.isPrivate) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.id !== file.ownerId) return notFound();
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Cache-Control": file.isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
      // Nettleseren skal aldri gjette filtypen (hindrer at en fil tolkes som HTML).
      "X-Content-Type-Options": "nosniff",
    },
  });
}
