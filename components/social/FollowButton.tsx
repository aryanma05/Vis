"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { followAction } from "@/app/actions/social";
import { buttonClass, type ButtonSize } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// Følg / følger. Oppdateres med en gang, og rulles tilbake hvis det feiler.
export default function FollowButton({
  userId,
  initialFollowing,
  loggedIn,
  size = "sm",
  name,
  className = "",
}: {
  userId: string;
  initialFollowing: boolean;
  loggedIn: boolean;
  size?: ButtonSize;
  name?: string;
  className?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [hover, setHover] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (!loggedIn) {
      router.push(`/logg-inn?neste=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const result = await followAction(userId, next);
      if (!result.ok) {
        setFollowing(!next);
        toast.error(result.error);
        return;
      }
      if (next && name) toast.success(`Du følger nå ${name}`);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={pending}
      aria-pressed={following}
      className={buttonClass({
        variant: following ? "secondary" : "primary",
        size,
        className: `${following && hover ? "border-danger/50 text-danger" : ""} min-w-[6.5rem] ${className}`,
      })}
    >
      {following ? (
        hover ? (
          "Slutt å følge"
        ) : (
          <>
            <Check className="size-4" aria-hidden="true" /> Følger
          </>
        )
      ) : (
        <>
          <Plus className="size-4" aria-hidden="true" strokeWidth={2.4} /> Følg
        </>
      )}
    </button>
  );
}
