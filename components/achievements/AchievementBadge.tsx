import type { CSSProperties } from "react";
import {
  BookOpen,
  Briefcase,
  Eye,
  GitBranch,
  Hammer,
  Handshake,
  IdCard,
  Lightbulb,
  Lock,
  MessagesSquare,
  Moon,
  NotebookPen,
  PawPrint,
  Rocket,
  Shovel,
  Sparkles,
  Trophy,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { TIER_COLORS, type AchievementDef, type AchievementIcon, type AchievementPattern } from "@/lib/achievement-defs";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  shovel: Shovel,
  hammer: Hammer,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  users: Users,
  messages: MessagesSquare,
  handshake: Handshake,
  notebook: NotebookPen,
  trophy: Trophy,
  wrench: Wrench,
  branch: GitBranch,
  book: BookOpen,
  eye: Eye,
  idcard: IdCard,
  briefcase: Briefcase,
  moon: Moon,
  rocket: Rocket,
  paw: PawPrint,
};

// Kanten rundt medaljen: lys for grunnmerket, metall for bronse, sølv og gull.
const RIMS = [
  "",
  "conic-gradient(from 200deg, #ffffffee, #ffffff55, #ffffffcc, #ffffff40, #ffffffee)",
  "conic-gradient(from 200deg, #ffd9ad, #9a5a26, #f1b27a, #7c4318, #ffd9ad)",
  "conic-gradient(from 200deg, #ffffff, #8794a6, #e6ebf1, #6f7b8c, #ffffff)",
  "conic-gradient(from 200deg, #fff6c2, #b9860f, #ffe27a, #9c6d00, #fff6c2)",
];

function pattern(kind: AchievementPattern, size: number): CSSProperties {
  const ink = "rgb(255 255 255 / 0.22)";
  switch (kind) {
    case "rays":
      return { backgroundImage: `repeating-conic-gradient(from 0deg at 50% 50%, ${ink} 0deg 9deg, transparent 9deg 24deg)` };
    case "dots":
      return { backgroundImage: `radial-gradient(${ink} 18%, transparent 22%)`, backgroundSize: `${size * 0.16}px ${size * 0.16}px` };
    case "rings":
      return { backgroundImage: `repeating-radial-gradient(circle at 50% 50%, ${ink} 0 1.5px, transparent 1.5px ${Math.max(5, size * 0.09)}px)` };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        backgroundSize: `${size * 0.17}px ${size * 0.17}px`,
        backgroundPosition: "center",
      };
    case "waves":
      return { backgroundImage: `repeating-linear-gradient(-28deg, ${ink} 0 2px, transparent 2px ${Math.max(6, size * 0.11)}px)` };
  }
}

// En prestasjon som medalje: farget skive med mønster og ikon, og en kant som viser
// nivået. ×2/×3/×4 står i en liten lapp nede til høyre, som på GitHub.
export default function AchievementBadge({
  def,
  tier,
  size = 56,
  className = "",
}: {
  def: AchievementDef;
  // 0 = ikke låst opp (vises grått med en lås).
  tier: number;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[def.icon];
  const locked = tier === 0;
  const [from, to] = def.colors;
  const rim = RIMS[Math.max(1, Math.min(tier, 4))];
  const inset = Math.max(2, Math.round(size * 0.065));

  return (
    <span className={`relative inline-block shrink-0 select-none ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className={`absolute inset-0 ${locked ? "opacity-50 grayscale" : ""}`}>
        <span className="absolute inset-0 rounded-full shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" style={{ background: rim }} />
        <span
          className="absolute overflow-hidden rounded-full"
          style={{ inset, background: `radial-gradient(circle at 32% 26%, ${from}, ${to} 78%)`, boxShadow: "inset 0 -4px 10px rgb(0 0 0 / 0.25)" }}
        >
          <span className="absolute inset-0" style={pattern(def.pattern, size)} />
          {/* Glansen øverst. */}
          <span className="absolute inset-x-[14%] top-[5%] h-[40%] rounded-full bg-gradient-to-b from-white/50 to-white/0" />
        </span>
        <Icon
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)]"
          style={{ width: size * 0.42, height: size * 0.42 }}
          strokeWidth={size < 40 ? 2.4 : 2}
        />
      </span>

      {locked && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-surface-2 text-mist ring-2 ring-ink"
          style={{ width: Math.max(16, size * 0.34), height: Math.max(16, size * 0.34) }}
        >
          <Lock style={{ width: Math.max(9, size * 0.17), height: Math.max(9, size * 0.17) }} strokeWidth={2.5} />
        </span>
      )}
      {tier >= 2 && (
        <span
          className="absolute -bottom-0.5 -right-1 rounded-full px-1.5 font-bold leading-[1.45] text-[#1b1406] shadow-[0_2px_6px_rgb(0_0_0/0.35)] ring-2 ring-ink"
          style={{ background: TIER_COLORS[tier - 1], fontSize: Math.max(9, Math.round(size * 0.19)) }}
        >
          ×{tier}
        </span>
      )}
    </span>
  );
}
