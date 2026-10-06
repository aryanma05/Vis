import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import { ButtonLink } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import ResetPasswordForm from "./ResetPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Nytt passord"), robots: { index: false } };
}

// Eldre lenker for nytt passord går via /api/auth/reset-password/<token>, som sender
// hit med ?token=… (eller ?error=INVALID_TOKEN). Nye forespørsler bruker kode.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const [{ token, error }, t] = await Promise.all([searchParams, getT()]);

  return (
    <AuthCard title={t("Lag nytt passord")}>
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-5 text-mist">
          <p>{t("Lenken er ugyldig eller har gått ut. Be om en kode i stedet, det går raskt.")}</p>
          <ButtonLink href="/glemt-passord">{t("Få en kode på e-post")}</ButtonLink>
        </div>
      )}
    </AuthCard>
  );
}
