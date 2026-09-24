import { redirect } from "next/navigation";

// Innlogging ligger på /logg-inn. Beholdt så gamle lenker fortsatt virker.
export default function LoginPage() {
  redirect("/logg-inn");
}
