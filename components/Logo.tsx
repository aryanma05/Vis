import Link from "next/link";

// «vis»-ordmerket. Prikken over i-en er aksentfargen.
export function Wordmark({ className = "text-xl" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-baseline font-extrabold tracking-[-0.06em] text-fg ${className}`}>
      v<span className="relative">ı<span aria-hidden="true" className="absolute left-1/2 top-[0.12em] size-[0.2em] -translate-x-1/2 rounded-full bg-ice" /></span>s
    </span>
  );
}

export default function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Vis – til forsiden" className={`inline-flex items-center ${className}`}>
      <Wordmark />
    </Link>
  );
}

// Rundt merke til sidemenyen.
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-full bg-primary text-on-primary ${className}`}>
      <span className="text-[15px] font-extrabold tracking-[-0.06em]">
        v<span className="relative">ı<span aria-hidden="true" className="absolute left-1/2 top-[0.12em] size-[0.2em] -translate-x-1/2 rounded-full bg-on-primary" /></span>s
      </span>
    </span>
  );
}
