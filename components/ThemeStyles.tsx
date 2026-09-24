// Fargene ligger som CSS-variabler i app/globals.css og bytter med data-theme,
// så klassene under er like for alle temaene. Beholdt slik at komponenter som
// bruker themeStyles[theme] fortsatt virker.
const shared = {
  page: "bg-ink text-fg",
  card: "border-line bg-surface",
  cardSoft: "border-line bg-ink/70",
  muted: "text-mist",
  accent: "text-ice",
  input: "border-line bg-ink text-fg placeholder:text-mist/60",
  button: "bg-primary text-on-primary hover:opacity-90",
  secondaryButton: "border-line bg-surface text-fg hover:border-ice",
} as const;

export const themeStyles = {
  midnight: shared,
  dark: shared,
  light: shared,
} as const;

export type ThemeName = keyof typeof themeStyles;
