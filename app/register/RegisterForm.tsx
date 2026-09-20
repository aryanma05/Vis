"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { isValidUsername, toUsernameBase } from "@/lib/username";
import { ui } from "@/components/ui";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function checkUsername(value: string) {
    if (!value) return setUsernameStatus("idle");
    if (!isValidUsername(value)) return setUsernameStatus("invalid");
    setUsernameStatus("checking");
    const { data } = await authClient.isUsernameAvailable({ username: value });
    setUsernameStatus(data?.available ? "free" : "taken");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const { data, error } = await authClient.signUp.email({
      name: name.trim(),
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
      ...(username ? { username } : {}),
    });

    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }

    const created = (data?.user as { username?: string } | undefined)?.username ?? username;
    router.push(created ? `/@${created}` : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="name" className={ui.label}>
          Navn
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Ditt navn"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!usernameTouched) {
              const suggestion = e.target.value.trim() ? toUsernameBase(e.target.value) : "";
              setUsername(suggestion);
              setUsernameStatus("idle");
            }
          }}
          onBlur={() => !usernameTouched && checkUsername(username)}
          className={ui.input}
        />
      </div>

      <div>
        <label htmlFor="username" className={ui.label}>
          Brukernavn
        </label>
        <div className="flex items-center rounded-lg border border-line bg-ink focus-within:border-ice focus-within:ring-2 focus-within:ring-ice/20">
          <span className="pl-4 text-mist">vis.no/@</span>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsernameTouched(true);
              setUsername(e.target.value.toLowerCase().replace(/\s/g, ""));
              setUsernameStatus("idle");
            }}
            onBlur={() => checkUsername(username)}
            className="w-full bg-transparent py-3 pr-4 text-fg outline-none"
          />
        </div>
        {usernameStatus === "free" && <p className="mt-1 text-sm text-emerald-300">Ledig!</p>}
        {usernameStatus === "taken" && <p className={ui.fieldError}>Brukernavnet er tatt.</p>}
        {usernameStatus === "invalid" && (
          <p className={ui.fieldError}>Bruk 2–39 tegn: små bokstaver, tall og - _ .</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className={ui.label}>
          E-post
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="navn@eksempel.no" className={ui.input} />
      </div>

      <div>
        <label htmlFor="password" className={ui.label}>
          Passord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Minst 8 tegn"
          className={ui.input}
        />
      </div>

      {error && <p className={ui.error}>{error}</p>}

      <button
        type="submit"
        disabled={pending || usernameStatus === "taken" || usernameStatus === "invalid"}
        className={`${ui.primary} mt-2 w-full`}
      >
        {pending ? "Oppretter konto…" : "Opprett konto"}
      </button>
    </form>
  );
}
