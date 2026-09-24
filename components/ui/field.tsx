import type { ReactNode } from "react";

// Felles stil for tekstfelter. aria-invalid gir rød ramme.
export const inputClass =
  "block w-full rounded-xl border border-line bg-ink-2/50 px-4 py-2.5 text-[15px] text-fg outline-none transition placeholder:text-mist/45 hover:border-mist/35 focus:border-ice/70 focus:bg-ink-2/80 focus:ring-4 focus:ring-ice/10 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger/70 aria-[invalid=true]:focus:ring-danger/10";

export const textareaClass = `${inputClass} min-h-28 resize-y leading-7`;

export const selectClass = `${inputClass} appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10 bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-width='1.6'%3E%3Cpath d='m6 8 4 4 4-4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")]`;

export const labelClass = "mb-2 block text-sm font-medium text-fg";

export function Hint({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-1.5 text-[13px] leading-5 text-mist/80 ${className}`}>{children}</p>;
}

export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] leading-5 text-danger">
      {children}
    </p>
  );
}

// Etikett, felt og hint/feil. `htmlFor` brukes når feltet ikke ligger inni etiketten.
export function Field({
  label,
  hint,
  error,
  htmlFor,
  optional,
  className = "",
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  const Wrapper = htmlFor ? "div" : "label";
  return (
    <Wrapper className={`block min-w-0 ${className}`}>
      <Label {...(htmlFor ? { htmlFor } : {})} className={labelClass}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-mist/60">valgfritt</span>}
      </Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <Hint>{hint}</Hint> : null}
    </Wrapper>
  );
}

// En seksjon i innstillingssidene: tittel og forklaring til venstre, innhold til høyre.
export function Section({
  title,
  description,
  children,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-6 border-b border-line py-10 last:border-b-0 md:grid-cols-[240px_1fr] md:gap-14">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-6 text-mist/80">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
