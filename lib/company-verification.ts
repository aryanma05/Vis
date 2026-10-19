import "server-only";

import { and, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { UserFacingError } from "@/lib/result";

const { company } = schema;

// Bekreftet bedrift. Kaster UserFacingError hvis navnet blir det samme som navnet eller adressen
// til en bekreftet bedrift (exceptCompanyId = bedriften selv ved endring), så ingen kan utgi seg for den.
export async function assertNameAvailable(name: string, exceptCompanyId?: string): Promise<void> {
  const wanted = name.trim().toLowerCase();
  const [taken] = await db
    .select({ id: company.id })
    .from(company)
    .where(
      and(
        isNotNull(company.verifiedAt),
        or(sql`lower(${company.name}) = ${wanted}`, sql`lower(${company.verifiedDomain}) = ${wanted}`),
        exceptCompanyId ? ne(company.id, exceptCompanyId) : undefined,
      ),
    )
    .limit(1);
  if (taken) throw new UserFacingError("Navnet tilhører en bekreftet bedrift. Velg et annet navn.");
}
