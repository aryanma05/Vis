import "server-only";

// Sender e-post (bekreftelse av e-postadresse og tilbakestilling av passord).
//
// Render sin gratisversjon blokkerer vanlig SMTP, så vi bruker HTTP-API-et til en
// e-posttjeneste. Sett én av disse i miljøvariablene:
//   BREVO_API_KEY   brevo.com – gratis 300 e-poster/dag, kan sende fra en bekreftet
//                   Gmail-adresse uten eget domene.
//   RESEND_API_KEY  resend.com – krever eget domene for å sende til andre enn deg selv.
// og EMAIL_FROM, f.eks. "Vis <navn@gmail.com>" (må være en avsender tjenesten har bekreftet).
//
// Uten dette: under utvikling skrives e-posten (med lenken) til terminalen, og i
// produksjon er e-postbekreftelse slått av (se lib/auth.ts).

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

export const emailProviderConfigured = Boolean((BREVO_API_KEY || RESEND_API_KEY) && EMAIL_FROM);

// Kan vi sende (eller vise) e-post med lenker? Styrer om e-postbekreftelse og
// «glemt passord» er slått på.
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

/* -------------------------------------------------------------------------- */
/*  Innholdet i e-postene                                                     */
/* -------------------------------------------------------------------------- */

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout({ heading, intro, button, url, outro }: { heading: string; intro: string; button: string; url: string; outro: string }) {
  const html = `<!doctype html>
<html lang="no"><body style="margin:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0b1220">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
      <tr><td>
        <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:.2em;color:#0b6e99">VIS</p>
        <h1 style="margin:0 0 12px;font-size:22px">${escape(heading)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155">${escape(intro)}</p>
        <a href="${escape(url)}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escape(button)}</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b">${escape(outro)}</p>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all">Virker ikke knappen? Kopier denne lenken inn i nettleseren:<br>${escape(url)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  const text = `${heading}\n\n${intro}\n\n${button}: ${url}\n\n${outro}`;
  return { html, text };
}

export function verificationEmail(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Bekreft e-posten din på Vis",
    ...layout({
      heading: `Hei ${name.split(" ")[0] || "der"}!`,
      intro: "Trykk på knappen for å bekrefte at dette er din e-postadresse. Da er kontoen din på Vis klar.",
      button: "Bekreft e-posten",
      url,
      outro: "Lenken virker i 24 timer. Har du ikke laget en konto på Vis, kan du se bort fra denne e-posten.",
    }),
  };
}

export function resetPasswordEmail(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Lag et nytt passord på Vis",
    ...layout({
      heading: `Hei ${name.split(" ")[0] || "der"}!`,
      intro: "Noen (forhåpentligvis du) ba om å lage et nytt passord for kontoen din på Vis.",
      button: "Lag nytt passord",
      url,
      outro: "Lenken virker i én time. Ba du ikke om dette, kan du se bort fra e-posten. Passordet ditt er ikke endret.",
    }),
  };
}
