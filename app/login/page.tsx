"use client";

import React, { useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

export default function LoginPage() {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !email.includes("@")) {
      setError("Skriv inn en gyldig e-postadresse.");
      return;
    }

    if (!password) {
      setError("Skriv inn passordet ditt.");
      return;
    }

    setIsLoading(true);

    window.setTimeout(() => {
      setIsLoading(false);
      setMessage(
        "Dette er foreløpig en demo. Innlogging kobles til backend senere."
      );
    }, 800);
  }

  const passwordToggleClasses =
    theme === "light"
      ? "border-[#D0D7E2] bg-[#E3E8F3] text-[#071A52] hover:border-[#086788] hover:bg-[#D6E0F0]"
      : theme === "dark"
      ? "border-[#334155] bg-[#111827] text-[#7DD3FC] hover:border-[#7DD3FC] hover:bg-[#1A2233]"
      : "border-[#174B76] bg-[#071A52] text-[#C7F9FF] hover:border-[#C7F9FF] hover:bg-[#086788]";

  return (
    <main className={`min-h-screen transition-colors duration-300 ${styles.page}`}>
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileNav />

        <div className="flex flex-1 items-center justify-center px-6 py-10 pb-28">
          <div className="mx-auto w-full max-w-md">
            <section
              className={`rounded-2xl border p-7 shadow-xl shadow-black/10 ${styles.card}`}
            >
              <p className={`text-sm font-medium ${styles.accent}`}>
                Din profil · vis
              </p>

              <h1 className="mt-3 text-3xl font-bold">Logg inn</h1>

              <p className={`mt-2 text-sm leading-7 ${styles.muted}`}>
                Logg inn for å se og redigere profilen din, prosjekter og
                innstillinger.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium"
                  >
                    E-post
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="navn@eksempel.no"
                    className={`w-full rounded-lg border px-4 py-3 outline-none focus:border-[#086788] focus:ring-2 focus:ring-[#086788]/20 ${styles.input}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium"
                  >
                    Passord
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Ditt passord"
                      className={`w-full rounded-lg border px-4 py-3 pr-20 outline-none focus:border-[#086788] focus:ring-2 focus:ring-[#086788]/20 ${styles.input}`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${passwordToggleClasses}`}
                    >
                      {showPassword ? "Skjul" : "Vis"}
                    </button>
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-500"
                  >
                    {error}
                  </p>
                )}

                {message && (
                  <p
                    role="status"
                    className={`rounded-lg border px-3 py-2 text-sm ${styles.cardSoft} ${styles.muted}`}
                  >
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`mt-2 w-full rounded-lg px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
                >
                  {isLoading ? "Logger inn..." : "Logg inn"}
                </button>
              </form>

              <p className={`mt-6 text-center text-sm ${styles.muted}`}>
                Har du ikke konto?{" "}
                <Link
                  href="/register"
                  className={`font-medium underline ${styles.accent}`}
                >
                  Opprett profil
                </Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}