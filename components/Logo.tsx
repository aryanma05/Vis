import Link from "next/link";
import { useId } from "react";

// «vis»-ordmerket. Prikken over i-en er aksentfargen.
export function Wordmark({ className = "text-xl" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-baseline font-bold tracking-[-0.055em] text-fg ${className}`}>
      v<span className="relative">ı<span aria-hidden="true" className="absolute left-1/2 top-[0.12em] size-[0.2em] -translate-x-1/2 rounded-full bg-ice" /></span>s
    </span>
  );
}

// Fargene i V-en, fra cyan øverst til venstre til dyp blå.
export const LOGO_CYAN = "#00EEFF";
export const LOGO_BLUE = "#1414FF";

// V-en er to avrundede streker som møtes nederst. Den høyre ligger over den venstre,
// som i originalen. Koordinatene er fra logofila (2000 px) delt på 10.
function VStrokes({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-l`} gradientUnits="userSpaceOnUse" x1="80.8" y1="80.8" x2="100" y2="120.9">
          <stop offset="0" stopColor={LOGO_CYAN} />
          <stop offset="1" stopColor={LOGO_BLUE} />
        </linearGradient>
        <linearGradient id={`${id}-r`} gradientUnits="userSpaceOnUse" x1="119.2" y1="80.8" x2="100" y2="120.9">
          <stop offset="0" stopColor={LOGO_BLUE} />
          <stop offset="1" stopColor={LOGO_CYAN} />
        </linearGradient>
      </defs>
      <path d="M80.8 80.8 100 120.9" fill="none" stroke={`url(#${id}-l)`} strokeWidth="16.8" strokeLinecap="round" />
      <path d="M119.2 80.8 100 120.9" fill="none" stroke={`url(#${id}-r)`} strokeWidth="16.8" strokeLinecap="round" />
    </>
  );
}

function useSvgId() {
  return `vis-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

// Bare V-en, uten sirkelen rundt.
export function VMark({ className = "size-6" }: { className?: string }) {
  const id = useSvgId();
  return (
    <svg viewBox="71.5 71.5 57 59" className={className} aria-hidden="true" focusable="false">
      <VStrokes id={id} />
    </svg>
  );
}

// Hele logoen: V-en i en hvit sirkel.
export function LogoBadge({ className = "size-10" }: { className?: string }) {
  const id = useSvgId();
  return (
    <svg viewBox="52.5 52.5 95 95" className={className} aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="47.5" fill="#fff" />
      <VStrokes id={id} />
    </svg>
  );
}

// Logoen med ordmerket ved siden av. Brukes i topplinjen på mobil, innlogging og bunnen.
export function LogoLockup({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const badge = { sm: "size-7", md: "size-8", lg: "size-10" }[size];
  const text = { sm: "text-[21px]", md: "text-2xl", lg: "text-3xl" }[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoBadge className={`${badge} shrink-0 rounded-full shadow-[0_2px_8px_-2px_rgb(0_0_0/0.3)]`} />
      <Wordmark className={text} />
    </span>
  );
}

export default function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Vis – til forsiden" className={`inline-flex items-center ${className}`}>
      <LogoLockup />
    </Link>
  );
}
