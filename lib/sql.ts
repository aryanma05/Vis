import { getTableName, sql, type Column } from "drizzle-orm";

// En kolonne med tabellnavnet foran, f.eks. "project"."id". Drizzle dropper
// tabellnavnet i select-feltene når spørringen bare leser én tabell. I en
// korrelert underspørring peker da "id" på den indre tabellen i stedet for den
// ytre, og tellingen blir feil. Bruk denne for den ytre kolonnen.
export const outer = (column: Column) => sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
