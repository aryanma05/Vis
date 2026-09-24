import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { isEmailEnabled } from "@/lib/auth";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = { title: "Glemt passord – vis" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Glemt passordet?">
      {isEmailEnabled ? (
        <ForgotPasswordForm />
      ) : (
        <p className="mt-4 text-mist">
          Tilbakestilling av passord er ikke satt opp ennå (e-post mangler på serveren). Logger du inn med GitHub,
          trenger du ikke passord.
        </p>
      )}
      <p className="mt-6 text-center text-sm text-mist">
        Kom du på det?{" "}
        <Link href="/logg-inn" className="font-medium text-fg underline">
          Logg inn
        </Link>
      </p>
    </AuthCard>
  );
}
