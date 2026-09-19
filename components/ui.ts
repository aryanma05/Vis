// Felles klasser så skjemaene ser like ut som resten av siden.
export const ui = {
  page: "min-h-screen bg-[#071A52] text-white",
  card: "rounded-2xl border border-[#174B76] bg-[#0A245E] p-6 shadow-xl shadow-black/20",
  label: "mb-2 block text-sm font-medium",
  hint: "mt-1 text-xs text-[#B8D8E3]/80",
  input:
    "w-full rounded-lg border border-[#174B76] bg-[#071A52] px-4 py-3 text-white outline-none placeholder:text-[#B8D8E3]/60 focus:border-[#C7F9FF] focus:ring-2 focus:ring-[#C7F9FF]/20",
  primary:
    "rounded-lg bg-[#C7F9FF] px-5 py-3 font-semibold text-[#071A52] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "rounded-lg border border-[#174B76] bg-[#0A245E] px-5 py-3 font-semibold text-white transition hover:border-[#C7F9FF] disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "rounded-lg border border-red-400/40 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/10",
  error: "rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100",
  fieldError: "mt-1 text-sm text-red-300",
  tag: "rounded-full border border-[#174B76] bg-[#071A52] px-3 py-1 text-xs text-[#C7F9FF]",
};
