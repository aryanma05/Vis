import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import GithubButton from "@/components/GithubButton";
import { isGithubConfigured } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(`/@${user.username}`);

  return (
    <main className="min-h-screen bg-[#071A52] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-flex text-sm text-[#B8D8E3] transition hover:text-white">
          ← Tilbake til vis
        </Link>

        <section className="mt-8 rounded-2xl border border-[#174B76] bg-[#0A245E] p-7 shadow-xl shadow-black/20">
          <p className="text-sm font-medium text-[#C7F9FF]">VIS</p>
          <h1 className="mt-3 text-3xl font-bold">Logg inn</h1>

          {isGithubConfigured && (
            <div className="mt-8">
              <GithubButton callbackURL="/" />
              <p className="mt-6 text-center text-xs uppercase tracking-widest text-[#B8D8E3]/70">eller</p>
            </div>
          )}

          <Suspense>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-[#B8D8E3]">
            Ny her?{" "}
            <Link href="/register" className="font-medium text-white underline">
              Lag en profil
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
