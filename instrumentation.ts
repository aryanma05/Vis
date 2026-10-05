import type { Instrumentation } from "next";
import { log } from "@/lib/log";

// Kjøres én gang når serveren starter: sjekker at oppsettet er komplett, så feil
// konfigurasjon synes i loggen med en gang og ikke først når en bruker treffer den.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("@/lib/env");
  for (const item of checkEnv()) {
    if (item.status === "ok") continue;
    (item.status === "error" ? log.error : log.warn)("config", { key: item.key, message: item.message });
  }
}

// Besøkende som lukker fanen eller går videre mens siden strømmes, er ikke en feil hos oss.
const CLIENT_ABORT = /destination stream closed early|aborted|ECONNRESET/i;

// Kalles av Next.js for alle feil som skjer på serveren (sider, API-ruter,
// server actions), så de havner som søkbare JSON-linjer i loggen og i feilloggen
// under /admin. Headere logges ikke – de kan inneholde informasjonskapsler.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (error instanceof Error && CLIENT_ABORT.test(error.message)) return;
  const digest = (error as { digest?: string }).digest;
  const path = request.path.split("?")[0];
  log.error("request.failed", {
    error,
    digest,
    method: request.method,
    path,
    route: context.routePath,
    kind: context.routeType,
  });
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordError } = await import("@/lib/errors");
    recordError({ source: "server", event: `${context.routeType}:${context.routePath}`, error, digest, path });
  }
};
