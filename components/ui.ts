// Felles klasser for skjemaene. Fargene er temavariabler (se app/globals.css).
export const ui = {
  page: "min-h-screen bg-ink text-fg",
  card: "rounded-2xl border border-line bg-surface/40 p-6",
  label: "mb-2 block text-sm font-medium",
  hint: "mt-1 text-xs text-mist/80",
  input:
    "w-full rounded-lg border border-line bg-ink px-4 py-3 text-fg outline-none placeholder:text-mist/60 focus:border-ice focus:ring-2 focus:ring-ice/20",
  primary:
    "rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "rounded-lg border border-line bg-surface px-5 py-3 font-semibold text-fg transition hover:border-ice disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10",
  error: "rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400",
  fieldError: "mt-1 text-sm text-red-400",
  tag: "rounded-md border border-line px-2.5 py-1 font-mono text-xs text-mist",
};
