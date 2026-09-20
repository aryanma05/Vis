// Små byggeklosser for skjemaene i redigeringssidene.
export const inputClass =
  "w-full rounded-lg border border-line bg-ink px-3.5 py-2.5 text-fg outline-none transition placeholder:text-mist/40 focus:border-primary focus:ring-2 focus:ring-ice/15";

export function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-mist/60">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-line py-10 md:grid-cols-[220px_1fr] md:gap-12">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-6 text-mist/80">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
