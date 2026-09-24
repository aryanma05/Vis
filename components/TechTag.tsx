"use client";

import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

type TechTagProps = {
  label: string;
  variant?: "solid" | "outline";
  size?: "sm" | "md";
};

export function TechTag({
  label,
  variant = "solid",
  size = "md",
}: TechTagProps) {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  const padding =
    size === "sm" ? "px-3 py-1 text-xs" : "px-3 py-1.5 text-sm";

  const variantClasses =
    variant === "solid"
      ? styles.cardSoft
      : `bg-transparent ${styles.accent}`;

  return (
    <span
      className={`inline-flex items-center rounded-full border ${padding} ${styles.card} ${variantClasses}`}
    >
      <span className={styles.accent}>{label}</span>
    </span>
  );
}