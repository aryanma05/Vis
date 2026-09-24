import Link from "next/link";

// Samme ramme som innloggingssiden, for de små sidene rundt kontoen
// (glemt passord, nytt passord, bekreftet e-post).
export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 pb-28 md:pb-16 md:pl-28">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-flex text-sm text-mist transition hover:text-fg">
          ← Tilbake til vis
        </Link>
        <section className="mt-8 rounded-2xl border border-line bg-surface p-7 shadow-xl shadow-black/20">
          <p className="text-sm font-medium text-ice">VIS</p>
          <h1 className="mt-3 text-3xl font-bold">{title}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}
