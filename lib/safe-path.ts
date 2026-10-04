// Bare interne stier, så en lenke som ?neste=… ikke kan sende brukeren til en annen side.
// Nettlesere tolker både «//vert» og «/\vert» som en annen vert.
export function safeInternalPath(path: string | null | undefined): string | null {
  return path && /^\/(?![/\\])/.test(path) ? path : null;
}
