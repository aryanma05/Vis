import Link from "next/link";
import { redirect } from "next/navigation";
import GithubButton from "@/components/GithubButton";
import { isGithubConfigured } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(`/@${user.username}`);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 pb-28 md:pb-16 md:pl-28">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex text-sm text-mist transition hover:text-fg"
        >
          ← Tilbake til vis
        </Link>

        <section className="mt-8 rounded-2xl border border-line bg-surface p-7 shadow-xl shadow-black/20">
          <p className="text-sm font-medium text-ice">VIS</p>

          <h1 className="mt-3 text-3xl font-bold">Kom i gang</h1>

          <p className="mt-2 text-mist">
            Opprett profilen din og vis frem arbeid, prosjekter og erfaring.
          </p>

          {isGithubConfigured && (
            <div className="mt-8">
              <GithubButton callbackURL="/ny?fra=github" label="Registrer deg med GitHub" />
              <p className="mt-6 text-center text-xs uppercase tracking-widest text-mist/70">eller med e-post</p>
            </div>
          )}

          <RegisterForm />

          <p className="mt-6 text-center text-sm text-mist">
            Har du allerede konto?{" "}
            <Link href="/logg-inn" className="font-medium text-fg underline">
              Logg inn
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
