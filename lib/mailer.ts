import "server-only";

import { log } from "@/lib/log";
import { siteUrl } from "@/lib/site";

// Sender e-post (koder for bekreftelse og nytt passord, og varsler).
//
// Render sin gratisversjon blokkerer vanlig SMTP, så vi bruker HTTP-API-et til en
// e-posttjeneste. Sett én av disse i miljøvariablene:
//   BREVO_API_KEY   brevo.com – gratis 300 e-poster/dag, kan sende fra en bekreftet
//                   Gmail-adresse uten eget domene.
//   RESEND_API_KEY  resend.com – krever eget domene for å sende til andre enn deg selv.
// og EMAIL_FROM, f.eks. "Vis <navn@gmail.com>" (må være en avsender tjenesten har bekreftet).
//
// Uten dette: under utvikling skrives e-posten (med koden) til terminalen, og i
// produksjon er e-postbekreftelse slått av (se lib/auth.ts).

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

export const emailProviderConfigured = Boolean((BREVO_API_KEY || RESEND_API_KEY) && EMAIL_FROM);

// Kan vi sende (eller vise) e-post? Styrer om e-postbekreftelse og «glemt passord»
// er slått på.
export const canSendEmail = emailProviderConfigured || process.env.NODE_ENV !== "production";

type Email = { to: string; subject: string; text: string; html: string };

function parseFrom(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1].replace(/^"|"$/g, "") || "Vis", email: match[2] } : { name: "Vis", email: from.trim() };
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`E-posten ble ikke sendt (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

export async function sendEmail(email: Email) {
  if (!emailProviderConfigured) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[e-post] Til: ${email.to}\nEmne: ${email.subject}\n\n${email.text}\n`);
      return;
    }
    throw new Error("E-post er ikke satt opp (BREVO_API_KEY eller RESEND_API_KEY, og EMAIL_FROM).");
  }

  const from = parseFrom(EMAIL_FROM!);
  if (BREVO_API_KEY) {
    await post("https://api.brevo.com/v3/smtp/email", { "api-key": BREVO_API_KEY }, {
      sender: from,
      to: [{ email: email.to }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    });
  } else {
    await post("https://api.resend.com/emails", { Authorization: `Bearer ${RESEND_API_KEY}` }, {
      from: EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}

// Varsel-e-poster skal aldri stoppe det brukeren holder på med.
export function sendEmailInBackground(email: Email) {
  sendEmail(email).catch((error) => log.error("email", { error, subject: email.subject }));
}

/* -------------------------------------------------------------------------- */
/*  Innholdet i e-postene                                                     */
/* -------------------------------------------------------------------------- */

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const INK = "#071a52";
const ICE = "#c7f9ff";

function frame(inner: string, footer: string) {
  return `<!doctype html>
<html lang="no"><head><meta name="color-scheme" content="light only"></head>
<body style="margin:0;background:#eef2f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #d0d7e2">
      <tr><td style="background:${INK};padding:22px 32px">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.03em;color:${ICE}">vis</span>
        <span style="font-size:12px;color:#b8d8e3;padding-left:8px">din faglige identitet</span>
      </td></tr>
      <tr><td style="padding:32px">${inner}</td></tr>
    </table>
    <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#64748b">${footer}</p>
  </td></tr></table>
</body></html>`;
}

const CODE_COPY = {
  "email-verification": {
    subject: (code: string) => `${code} er koden din for å bekrefte e-posten på Vis`,
    heading: "Bekreft e-posten din",
    intro: "Skriv inn koden på Vis for å bekrefte at dette er din e-postadresse. Da er profilen din klar.",
  },
  "forget-password": {
    subject: (code: string) => `${code} er koden for nytt passord på Vis`,
    heading: "Lag et nytt passord",
    intro: "Noen (forhåpentligvis du) ba om å lage et nytt passord for kontoen din. Skriv inn koden på Vis for å fortsette.",
  },
  "sign-in": {
    subject: (code: string) => `${code} er innloggingskoden din på Vis`,
    heading: "Logg inn på Vis",
    intro: "Skriv inn koden på Vis for å logge inn.",
  },
  "change-email": {
    subject: (code: string) => `${code} er koden for å bytte e-post på Vis`,
    heading: "Bekreft den nye e-posten",
    intro: "Skriv inn koden på Vis for å bytte til denne e-postadressen.",
  },
} as const;

export type CodePurpose = keyof typeof CODE_COPY;

export function verificationCodeEmail(to: string, code: string, purpose: CodePurpose, minutes: number): Email {
  const copy = CODE_COPY[purpose];
  const spaced = code.split("").join(" ");
  const inner = `
    <h1 style="margin:0 0 10px;font-size:24px;letter-spacing:-0.02em">${escape(copy.heading)}</h1>
    <p style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#334155">${escape(copy.intro)}</p>
    <div style="background:#f5f7fb;border:1px solid #d0d7e2;border-radius:16px;padding:22px;text-align:center">
      <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.18em;color:${INK}">${escape(spaced)}</div>
      <div style="margin-top:8px;font-size:12px;color:#64748b">Koden virker i ${minutes} minutter</div>
    </div>
    <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#64748b">Har du ikke bedt om dette, kan du se bort fra e-posten. Ingen får tilgang uten koden.</p>`;
  return {
    to,
    subject: copy.subject(code),
    html: frame(inner, "Denne e-posten ble sendt fordi noen skrev inn adressen din på Vis."),
    text: `${copy.heading}\n\n${copy.intro}\n\nKoden din: ${code}\n\nKoden virker i ${minutes} minutter. Har du ikke bedt om dette, kan du se bort fra e-posten.`,
  };
}

function buttonEmail({
  to,
  subject,
  heading,
  intro,
  quote,
  button,
  url,
  outro,
  footer,
}: {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  quote?: string | null;
  button: string;
  url: string;
  outro?: string;
  footer: string;
}): Email {
  const inner = `
    <h1 style="margin:0 0 10px;font-size:22px;letter-spacing:-0.02em">${escape(heading)}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">${escape(intro)}</p>
    ${quote ? `<blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid ${INK};background:#f5f7fb;border-radius:0 12px 12px 0;font-size:14px;line-height:1.6;color:#334155">${escape(quote)}</blockquote>` : ""}
    <a href="${escape(url)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${escape(button)}</a>
    ${outro ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b">${escape(outro)}</p>` : ""}
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all">Virker ikke knappen? Kopier lenken: ${escape(url)}</p>`;
  const text = `${heading}\n\n${intro}${quote ? `\n\n«${quote}»` : ""}\n\n${button}: ${url}${outro ? `\n\n${outro}` : ""}`;
  return { to, subject, html: frame(inner, footer), text };
}

export function resetPasswordEmail(to: string, name: string, url: string): Email {
  return buttonEmail({
    to,
    subject: "Lag et nytt passord på Vis",
    heading: `Hei ${name.split(" ")[0] || "der"}!`,
    intro: "Noen (forhåpentligvis du) ba om å lage et nytt passord for kontoen din på Vis.",
    button: "Lag nytt passord",
    url,
    outro: "Lenken virker i én time. Ba du ikke om dette, kan du se bort fra e-posten. Passordet ditt er ikke endret.",
    footer: "Denne e-posten ble sendt fordi noen ba om nytt passord for kontoen din på Vis.",
  });
}

// Varsel om aktivitet (kommentar, svar, omtale, ny følger).
export function notificationEmail({
  to,
  subject,
  heading,
  intro,
  quote,
  path,
  button,
}: {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  quote?: string | null;
  path: string;
  button: string;
}): Email {
  const base = siteUrl();
  return buttonEmail({
    to,
    subject,
    heading,
    intro,
    quote: quote ? (quote.length > 280 ? `${quote.slice(0, 277)}…` : quote) : null,
    button,
    url: `${base}${path}`,
    footer: `Du får denne e-posten fordi du har slått på e-postvarsler på Vis. Skru dem av under Konto → Varsler: ${base}/profil/rediger/konto#varsler`,
  });
}
