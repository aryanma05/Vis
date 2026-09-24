import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Nytt passord – vis" };

// Lenken i e-posten går via /api/auth/reset-password/<token>, som sender hit med
// ?token=… (eller ?error=INVALID_TOKEN hvis lenken er brukt eller utløpt).
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;

  return (
    <AuthCard title="Lag nytt passord">
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-4 space-y-4 text-mist">
          <p>Lenken er ugyldig eller har gått ut. Lenker for nytt passord virker i én time, og bare én gang.</p>
          <Link href="/glemt-passord" className="inline-block font-medium text-fg underline">
            Be om en ny lenke
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
