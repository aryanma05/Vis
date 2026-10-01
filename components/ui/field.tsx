import type { ReactNode } from "react";

// Felles stil for tekstfelter. aria-invalid gir rød ramme.
// Felter som litt nedsenket glass. aria-invalid gir rød kant.
export const inputClass =
  "block w-full rounded-[14px] bg-fill px-4 py-2.5 text-[15px] text-fg outline-none inset-ring inset-ring-line inset-shadow-[0_1px_2px_rgb(0_0_0/0.1)] transition placeholder:text-mist/70 focus:bg-fill-2 focus:ring-2 focus:ring-sea/50 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/60";

export const textareaClass = `${inputClass} min-h-28 resize-y leading-7`;

export const selectClass = `${inputClass} appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10 bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-width='1.6'%3E%3Cpath d='m6 8 4 4 4-4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")]`;

export const labelClass = "mb-2 block text-sm font-medium text-fg";

export function Hint({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-1.5 text-[13px] leading-5 text-mist ${className}`}>{children}</p>;
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
        {optional && <span className="ml-1.5 font-normal text-mist">valgfritt</span>}
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
    <section id={id} className="grid scroll-mt-24 gap-5 border-b border-line py-10 last:border-b-0 md:grid-cols-[220px_1fr] md:gap-12">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-mist">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
