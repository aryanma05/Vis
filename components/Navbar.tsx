import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-[#174B76] bg-[#071A52]/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          vis
        </Link>

        <Link
          href="/register"
          className="rounded-lg border border-[#174B76] px-4 py-2 text-sm font-medium text-[#C7F9FF] transition hover:border-[#C7F9FF] hover:bg-[#0A245E]"
        >
          Create profile
        </Link>
      </div>
    </header>
  );
}