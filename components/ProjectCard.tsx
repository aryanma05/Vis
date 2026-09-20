"use client";

import Link from "next/link";
import { TechTag } from "./TechTag";
import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

type ProjectCardProps = {
  id: string;
  title: string;
  description: string;
  technologies: string[];
};

export function ProjectCard({
  id,
  title,
  description,
  technologies,
}: ProjectCardProps) {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  const hoverBorder =
    theme === "light"
      ? "hover:border-[#086788]"
      : "hover:border-[#C7F9FF]";

  const hoverTitle =
    theme === "light"
      ? "group-hover:text-[#086788]"
      : "group-hover:text-[#C7F9FF]";

  return (
    <Link
      href={`/prosjekt/${id}`}
      aria-label={`Åpne prosjektet ${title}`}
      className={`group block rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-[#086788] ${styles.card} ${hoverBorder}`}
    >
      <h3 className={`text-lg font-semibold transition ${hoverTitle}`}>
        {title}
      </h3>

      <p className={`mt-3 text-sm leading-6 ${styles.muted}`}>
        {description}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {technologies.map((technology) => (
          <TechTag key={technology} label={technology} size="sm" />
        ))}
      </div>
    </Link>
  );
}