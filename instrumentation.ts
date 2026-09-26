import type { Instrumentation } from "next";
import { log } from "@/lib/log";

// Kalles av Next.js for alle feil som skjer på serveren (sider, API-ruter,
// server actions), så de havner som søkbare JSON-linjer i loggen. Headere
// logges ikke – de kan inneholde informasjonskapsler.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  log.error("request.failed", {
    error,
    digest: (error as { digest?: string }).digest,
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    kind: context.routeType,
  });
};
