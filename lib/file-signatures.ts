// Filtypen avgjøres av de første bytene i filen, ikke av filnavn/MIME fra nettleseren.
// Ligger for seg selv (uten database) så den kan brukes og testes overalt.

export type SniffedImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/avif";

export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

export function isPdf(bytes: Uint8Array) {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}
