import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 rounded-lg px-2.5 text-xs",
  sm: "h-9 rounded-lg px-3.5 text-sm",
  md: "h-11 rounded-xl px-5 text-[15px]",
  lg: "h-13 rounded-xl px-7 text-base",
  icon: "size-10 rounded-xl",
  "icon-sm": "size-8 rounded-lg",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-[1.08] active:scale-[0.98]",
  secondary: "border border-line bg-surface text-fg hover:border-ice/50 hover:bg-surface-2 active:scale-[0.98]",
  outline: "border border-line text-fg hover:border-ice/50 hover:bg-surface/60 active:scale-[0.98]",
  ghost: "text-mist hover:bg-surface/80 hover:text-fg",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
  link: "h-auto px-0 text-ice underline-offset-4 hover:underline",
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
