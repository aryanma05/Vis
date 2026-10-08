import "server-only";

// Intervjubooking. P5 fyller inn resten av modulen.

// Planlagt jobb: påminnelse dagen før til verten og kandidaten. Gir antall påminnelser. P5 fyller inn.
export async function sendInterviewReminders(): Promise<number> {
  return 0;
}

// Planlagt jobb: sletter tider som var for mer enn 30 dager siden. Gir antall slettet. P5 fyller inn.
export async function purgeOldSlots(): Promise<number> {
  return 0;
}
