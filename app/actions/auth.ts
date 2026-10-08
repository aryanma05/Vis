"use server";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { runAction } from "@/lib/action";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { enforce } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { UserFacingError } from "@/lib/result";

// Koden i e-posten må matches mot en e-postadresse. Logger man inn med brukernavn,
// slås e-posten opp her på serveren, så den aldri sendes til nettleseren.
async function resolveEmail(identifier: string) {
  const value = identifier.trim().replace(/^@/, "").toLowerCase();
  if (value.includes("@")) return value;
  const [row] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.username, value)).limit(1);
  return row?.email.toLowerCase() ?? null;
}

function toUserFacing(error: unknown): never {
  if (isAPIError(error)) {
    throw new UserFacingError(
      authErrorMessage({ code: error.body?.code, message: error.body?.message, status: error.statusCode }),
    );
  }
  throw error;
}

// Bekrefter e-posten med koden og logger inn (autoSignInAfterVerification).
export async function verifyEmailCodeAction(identifier: string, code: string) {
  return runAction(async () => {
    const otp = String(code ?? "").replace(/\D/g, "");
    if (otp.length !== 6) throw new UserFacingError("Koden har seks sifre.");
    const email = await resolveEmail(String(identifier ?? ""));
    if (!email) throw new UserFacingError("Koden stemmer ikke. Sjekk sifrene og prøv igjen.");
    try {
      const result = await auth.api.verifyEmailOTP({ body: { email, otp }, headers: await headers() });
      const username = (result.user as { username?: string }).username ?? null;
      return { username };
    } catch (error) {
      toUserFacing(error);
    }
  }, "auth.verify-code");
}

// Sender en ny kode. Maks én per halve minutt per adresse, og et fast antall per IP-adresse
// og per e-postadresse (lib/auth-rules.ts). Server Actions går utenom Better Auth sin
// egen grense per IP, så den settes her.
export async function resendEmailCodeAction(identifier: string) {
  return runAction(async () => {
    await enforce("authCode", await clientIp());
    const email = await resolveEmail(String(identifier ?? ""));
    // Svarer likt uansett om kontoen finnes, så ingen kan sjekke hvem som har konto.
    if (!email) return { sent: true };

    const [recent] = await db
      .select({ createdAt: schema.verification.createdAt })
      .from(schema.verification)
      .where(eq(schema.verification.identifier, `email-verification-otp-${email}`))
      .orderBy(desc(schema.verification.createdAt))
      .limit(1);
    if (recent && Date.now() - recent.createdAt.getTime() < 30_000) throw new UserFacingError("Vent litt før du ber om en ny kode.");

    try {
      await auth.api.sendVerificationOTP({ body: { email, type: "email-verification" }, headers: await headers() });
    } catch (error) {
      toUserFacing(error);
    }
    return { sent: true };
  }, "auth.resend-code");
}
