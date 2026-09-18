import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-[#071A52] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex text-sm text-[#B8D8E3] transition hover:text-white"
        >
          ← Tilbake til vis
        </Link>

        <section className="mt-8 rounded-2xl border border-[#174B76] bg-[#0A245E] p-7 shadow-xl shadow-black/20">
          <p className="text-sm font-medium text-[#C7F9FF]">VIS</p>

          <h1 className="mt-3 text-3xl font-bold">Kom i gang</h1>

          <p className="mt-2 text-[#B8D8E3]">
            Opprett profilen din og vis frem arbeid, prosjekter og erfaring.
          </p>

          <form className="mt-8 space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">
                Navn
              </label>

              <input
                id="name"
                type="text"
                placeholder="Ditt navn"
                className="w-full rounded-lg border border-[#174B76] bg-[#071A52] px-4 py-3 text-white outline-none placeholder:text-[#B8D8E3]/60 focus:border-[#C7F9FF] focus:ring-2 focus:ring-[#C7F9FF]/20"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                E-post
              </label>

              <input
                id="email"
                type="email"
                placeholder="navn@eksempel.no"
                className="w-full rounded-lg border border-[#174B76] bg-[#071A52] px-4 py-3 text-white outline-none placeholder:text-[#B8D8E3]/60 focus:border-[#C7F9FF] focus:ring-2 focus:ring-[#C7F9FF]/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Passord
              </label>

              <input
                id="password"
                type="password"
                placeholder="Minst 8 tegn"
                className="w-full rounded-lg border border-[#174B76] bg-[#071A52] px-4 py-3 text-white outline-none placeholder:text-[#B8D8E3]/60 focus:border-[#C7F9FF] focus:ring-2 focus:ring-[#C7F9FF]/20"
              />
            </div>

            <button
              type="button"
              className="mt-2 w-full rounded-lg bg-[#C7F9FF] px-4 py-3 font-semibold text-[#071A52] transition hover:bg-white"
            >
              Opprett konto
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#B8D8E3]">
            Har du allerede konto?{" "}
            <Link href="/login" className="font-medium text-white underline">
              Logg inn
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}