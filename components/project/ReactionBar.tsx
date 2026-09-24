"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Lightbulb, Sparkles } from "lucide-react";
import { toggleReactionAction } from "@/app/actions/social";
import { toast } from "@/components/ui/toast";
import { REACTION_LABELS, REACTION_TYPES, type ReactionType } from "@/lib/constants";

const ICONS = { like: Heart, useful: Lightbulb, inspiring: Sparkles } as const;
const ACTIVE = {
  like: "border-[#ff9fb5]/60 bg-[#ff9fb5]/15 text-[#ff9fb5]",
  useful: "border-[#ffd98a]/60 bg-[#ffd98a]/15 text-[#ffd98a]",
  inspiring: "border-ice/60 bg-ice/15 text-ice",
} as const;

// Lik / Nyttig / Inspirerende. Oppdateres med en gang og rulles tilbake ved feil.
export default function ReactionBar({
  projectId,
  initial,
  loggedIn,
  disabled = false,
}: {
  projectId: string;
  initial: { counts: Record<ReactionType, number>; mine: ReactionType[] };
  loggedIn: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [popped, setPopped] = useState<ReactionType | null>(null);
  const [, startTransition] = useTransition();

  function toggle(type: ReactionType) {
    if (!loggedIn) {
      router.push(`/logg-inn?neste=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (disabled) return;
    const on = !state.mine.includes(type);
    const previous = state;
    setState({
      counts: { ...state.counts, [type]: Math.max(0, state.counts[type] + (on ? 1 : -1)) },
      mine: on ? [...state.mine, type] : state.mine.filter((t) => t !== type),
    });
    if (on) {
      setPopped(type);
      setTimeout(() => setPopped(null), 420);
    }
    startTransition(async () => {
      const result = await toggleReactionAction(projectId, type);
      if (!result.ok) {
        setState(previous);
        toast.error(result.error);
        return;
      }
      setState(result.data);
    });
  }

  return (
    <div role="group" aria-label="Reaksjoner" className="flex flex-wrap gap-2">
      {REACTION_TYPES.map((type) => {
        const Icon = ICONS[type];
        const on = state.mine.includes(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={on}
            title={disabled ? "Du kan ikke reagere på ditt eget prosjekt" : REACTION_LABELS[type]}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition active:scale-95 ${
              on ? ACTIVE[type] : "border-line text-fg/90 hover:border-mist/50 hover:bg-surface"
            } ${disabled ? "cursor-default opacity-80 hover:bg-transparent" : ""}`}
          >
            <Icon className={`size-4 ${popped === type ? "animate-[pop_420ms_var(--ease-spring)]" : ""}`} fill={on && type === "like" ? "currentColor" : "none"} aria-hidden="true" />
            <span>{REACTION_LABELS[type]}</span>
            <span className={`tabular-nums ${on ? "" : "text-mist"}`}>{state.counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
