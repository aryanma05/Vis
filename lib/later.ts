import "server-only";

import { after } from "next/server";

// Kjører etter at svaret er sendt til brukeren (e-post, webhooks og logg skal aldri gjøre det
// tregt). Utenfor en forespørsel (f.eks. i tester og planlagte jobber) kjøres det med en gang.
export function later(fn: () => Promise<unknown> | void) {
  try {
    after(fn);
  } catch {
    void fn();
  }
}
