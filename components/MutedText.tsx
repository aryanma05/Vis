"use client";

import React from "react";
import { useTheme } from "@/components/ThemeProvider";

export default function MutedText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();

  const base =
    theme === "light" ? "text-[#1F2933]" : "text-[#B8D8E3]";

  return <p className={`${base} ${className}`}>{children}</p>;
}