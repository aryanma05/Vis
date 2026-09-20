import React from "react";

// Dempet brødtekst. Fargen følger temaet (se app/globals.css).
export default function MutedText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`text-mist ${className}`}>{children}</p>;
}
