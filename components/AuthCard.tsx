import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";

// Ramme for innlogging, registrering og sidene rundt kontoen: ett kort midt på siden.
export default async function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const t = await getT();
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 pb-28 pt-8 md:min-h-screen md:py-16 md:pl-28 md:pr-8">
      <div className="group w-full max-w-[420px]">
        {/* Tittelen skjules mens man skriver inn koden fra e-posten (components/auth/VerifyEmailCode.tsx). */}
        <div className="mb-7 text-center group-has-[[data-verify-step]]:hidden">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em]">{title}</h1>
          {subtitle && <p className="mx-auto mt-2 max-w-sm leading-7 text-mist">{subtitle}</p>}
        </div>
        <div className="rounded-[28px] glass-card p-6 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-mist">
          <Link href="/personvern" className="hover:text-fg">
            {t("Personvern")}
          </Link>
          <span className="mx-2">·</span>
          <Link href="/vilkar" className="hover:text-fg">
            {t("Vilkår")}
          </Link>
          <span className="mx-2">·</span>
          <Link href="/retningslinjer" className="hover:text-fg">
            {t("Retningslinjer")}
          </Link>
        </p>
      </div>
    </main>
  );
}
