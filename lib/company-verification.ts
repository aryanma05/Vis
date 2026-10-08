import "server-only";

// Bekreftet bedrift. P6 fyller inn resten av modulen.

// Kaster UserFacingError hvis navnet blir det samme som navnet eller adressen til en
// bekreftet bedrift (exceptCompanyId = bedriften selv ved endring). P6 fyller inn.
export async function assertNameAvailable(name: string, exceptCompanyId?: string): Promise<void> {
  void name;
  void exceptCompanyId;
}
