import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.01em] transition duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

// Kapsler, som knappene i iOS.
const sizes: Record<ButtonSize, string> = {
  xs: "h-8 rounded-full px-3 text-xs",
  sm: "h-9 rounded-full px-4 text-sm",
  md: "h-11 rounded-full px-5 text-[15px]",
  lg: "h-12 rounded-full px-6 text-base",
  icon: "size-10 rounded-full",
  "icon-sm": "size-8 rounded-full",
};

// Hovedknappen er farget glass (lys kant øverst), de andre er klart glass.
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary bg-linear-to-b from-white/15 to-transparent text-on-primary inset-shadow-[0_1px_0.5px_rgb(255_255_255/0.45)] shadow-[0_8px_20px_-10px_rgb(0_0_0/0.45)] hover:opacity-90",
  secondary: "glass-chip text-fg hover:bg-fill-2",
  outline: "text-fg inset-ring inset-ring-line hover:bg-fill",
  ghost: "text-mist hover:bg-fill hover:text-fg",
  danger: "bg-danger/10 text-danger inset-ring inset-ring-danger/20 hover:bg-danger/15",
  link: "h-auto px-0 text-ice underline-offset-4 hover:underline active:scale-100",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `${base} ${variant === "link" ? "" : sizes[size]} ${variants[variant]} ${className}`.trim();
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80 ${className}`}
    />
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ variant, size, loading = false, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}
