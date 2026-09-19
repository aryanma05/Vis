import type { db } from "@/db";

// Typen til en transaksjon, så hjelpefunksjoner kan brukes både med og uten.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
