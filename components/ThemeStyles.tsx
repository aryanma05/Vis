export const themeStyles = {
  midnight: {
    page: "bg-[#071A52] text-white",
    card: "border-[#174B76] bg-[#0A245E]",
    cardSoft: "border-[#174B76] bg-[#071A52]/70",
    muted: "text-[#B8D8E3]",
    accent: "text-[#C7F9FF]",
    input: "border-[#174B76] bg-[#071A52] text-white placeholder:text-[#B8D8E3]/60",
    button: "bg-[#C7F9FF] text-[#071A52] hover:bg-white",
    secondaryButton: "border-[#174B76] bg-[#0A245E] text-white hover:border-[#C7F9FF]",
  },
  dark: {
    page: "bg-[#050816] text-[#E5F0FF]",
    card: "border-[#1F2937] bg-[#0B1220]",
    cardSoft: "border-[#1F2937] bg-[#050816]",
    muted: "text-[#94A3B8]",
    accent: "text-[#7DD3FC]",
    input: "border-[#1F2937] bg-[#050816] text-[#E5F0FF] placeholder:text-[#94A3B8]/60",
    button: "bg-[#7DD3FC] text-[#050816] hover:bg-white",
    secondaryButton: "border-[#1F2937] bg-[#0B1220] text-[#E5F0FF] hover:border-[#7DD3FC]",
  },
  light: {
    page: "bg-[#F5F7FB] text-[#071A52]",
    card: "border-[#D0D7E2] bg-white",
    cardSoft: "border-[#D0D7E2] bg-[#F0F3FA]",
    muted: "text-[#475569]",
    accent: "text-[#086788]",
    input: "border-[#D0D7E2] bg-[#F5F7FB] text-[#071A52] placeholder:text-[#475569]/60",
    button: "bg-[#071A52] text-white hover:bg-[#0A245E]",
    secondaryButton: "border-[#D0D7E2] bg-white text-[#071A52] hover:border-[#086788]",
  },
} as const;

export type ThemeName = keyof typeof themeStyles;