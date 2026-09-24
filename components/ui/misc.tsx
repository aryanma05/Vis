import Link from "next/link";
import type { ReactNode } from "react";

// Teknologi-/kategorimerke. Med href blir det en lenke.
export function Tag({
  children,
  href,
  active = false,
  size = "sm",
  count,
}: {
  children: ReactNode;
  href?: string;
  active?: boolean;
  size?: "xs" | "sm";
  count?: number;
}) {
  const cls = `inline-flex shrink-0 items-center gap-1.5 rounded-md border font-mono transition ${
    size === "xs" ? "px-1.5 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-xs"
  } ${
    active
      ? "border-primary bg-primary text-on-primary"
      : "border-line text-mist hover:border-mist/50 hover:text-fg"
  }`;
  const inner = (
    <>
      {children}
      {count !== undefined && <span className={active ? "text-on-primary/60" : "text-mist/50"}>{count}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-xl ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`blueprint relative overflow-hidden rounded-3xl border border-dashed border-line px-6 py-16 text-center md:py-20 ${className}`}>
      {icon && (
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-ice">{icon}</div>
      )}
      <p className="text-xl font-semibold tracking-tight text-fg">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-mist">{children}</div>}
      {action && <div className="mt-7 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-ink-2 px-1.5 font-mono text-[10.5px] text-mist">
      {children}
    </kbd>
  );
}

// Overskrift for en seksjon: liten mono-etikett over en stor tittel.
export function SectionHeading({
  eyebrow,
  title,
  action,
  className = "",
  as: As = "h2",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="label-mono">{eyebrow}</p>}
        <As className={`${eyebrow ? "mt-2.5" : ""} text-2xl font-bold tracking-tight text-fg md:text-3xl`}>{title}</As>
      </div>
      {action}
    </div>
  );
}

// Liten statistikk-verdi (tall + etikett).
export function Stat({ value, label, href }: { value: ReactNode; label: ReactNode; href?: string }) {
  const inner = (
    <>
      <span className="block text-lg font-semibold tabular-nums tracking-tight text-fg">{value}</span>
      <span className="block text-[13px] text-mist">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg transition hover:opacity-80">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

// Kort tall: 1 234 -> "1,2k".
export function compactNumber(n: number) {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(".", ",")}m`;
}
