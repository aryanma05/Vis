// Sender en feil fra nettleseren til feilloggen (app/api/feil). Feiler stille.
export function reportClientError(error: Error & { digest?: string }) {
  try {
    const body = JSON.stringify({
      message: error.message || error.name,
      digest: error.digest,
      path: window.location.pathname,
      stack: error.stack,
    });
    if (navigator.sendBeacon?.(new URL("/api/feil", window.location.origin), new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/feil", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // Ingenting å gjøre.
  }
}
