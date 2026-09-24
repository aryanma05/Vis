import type { CSSProperties, ReactNode } from "react";

// Glir inn når elementet kommer til syne på skjermen. Ren CSS (scroll-drevne
// animasjoner), så innholdet er synlig med en gang for søkemotorer og nettlesere
// uten støtte – der står det bare stille.
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  // Forsinkelse blir til et senere startpunkt i animasjonen.
  const style = delay ? ({ "--reveal-start": `${Math.round(delay * 60)}%` } as CSSProperties) : undefined;
  return (
    <As className={`reveal ${className}`} style={style}>
      {children}
    </As>
  );
}
