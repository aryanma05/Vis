import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import GithubButton from "@/components/GithubButton";
import { isEmailEnabled, isGithubConfigured } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(`/@${user.username}`);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 pb-28 md:pb-16 md:pl-28">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-flex text-sm text-mist transition hover:text-fg">
          ← Tilbake til vis
        </Link>

        <section className="mt-8 rounded-2xl border border-line bg-surface p-7 shadow-xl shadow-black/20">
          <p className="text-sm font-medium text-ice">VIS</p>
          <h1 className="mt-3 text-3xl font-bold">Logg inn</h1>

          {isGithubConfigured && (
            <div className="mt-8">
              <GithubButton callbackURL="/" />
              <p className="mt-6 text-center text-xs uppercase tracking-widest text-mist/70">eller</p>
            </div>
          )}

          <Suspense>
            <LoginForm canResetPassword={isEmailEnabled} />
          </Suspense>

          <p className="mt-6 text-center text-sm text-mist">
            Ny her?{" "}
            <Link href="/register" className="font-medium text-fg underline">
              Lag en profil
            </Link>
          </p>
          <p className="mt-3 text-center text-xs">
            <Link href="/personvern" className="text-mist/80 underline underline-offset-2 hover:text-fg">
              Personvern
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
