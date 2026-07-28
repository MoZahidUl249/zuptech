import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound email. The only transactional message today is the password-reset
 * OTP, but everything here is message-agnostic so the next one (order
 * confirmations, invoices) plugs in without touching auth.
 *
 * With SMTP_HOST unset the module logs instead of sending. That keeps local
 * dev and CI working with no credentials — the OTP shows up in the server log,
 * exactly where it used to. It is a *log*, never a response body: the code
 * must never travel back to the browser that asked for it.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
// Implicit TLS (port 465) vs STARTTLS (587). Explicit env wins; otherwise
// infer from the port, which is right for every mainstream provider.
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : SMTP_PORT === 465;
const MAIL_FROM = process.env.MAIL_FROM ?? "ZUP TECH <no-reply@zuptech.local>";

/** Built once — a transporter pools connections, so per-call creation would
 *  open a new TCP+TLS handshake for every message. */
const transporter: Transporter | null = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } }
        : {}),
    })
  : null;

export const mailIsConfigured = transporter !== null;

/**
 * Send one message. Throws on transport failure — callers that must not leak
 * whether an account exists (password reset) catch and swallow.
 */
export async function sendMail(msg: MailMessage): Promise<void> {
  if (!transporter) {
    console.log(
      `[mail] SMTP not configured — would send to ${msg.to}\n` +
        `       subject: ${msg.subject}\n` +
        `       ${msg.text.replace(/\n/g, "\n       ")}`,
    );
    return;
  }
  await transporter.sendMail({ from: MAIL_FROM, ...msg });
}

/* ===== Templates ===== */

const BRAND_BLUE = "#0b4fe0";

/** Password-reset OTP. Deliberately plain: a table-free, inline-styled block
 *  survives every mail client, and the code is readable from the plain-text
 *  part alone. */
export function otpEmail(otp: string): Omit<MailMessage, "to"> {
  return {
    subject: `${otp} is your ZUP TECH password reset code`,
    text:
      `Your ZUP TECH password reset code is ${otp}.\n\n` +
      `It expires in 10 minutes and can be used once.\n\n` +
      `If you didn't ask to reset your password, ignore this email — ` +
      `your password stays unchanged. Never share this code with anyone, ` +
      `including someone claiming to be from ZUP TECH.`,
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#22262e">
  <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:${BRAND_BLUE};letter-spacing:-0.02em">ZUP TECH</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Use this code to reset your password:</p>
  <p style="margin:0 0 16px;font-size:34px;font-weight:800;letter-spacing:0.18em;color:${BRAND_BLUE}">${otp}</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#6b7078">It expires in 10 minutes and can be used once.</p>
  <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8f98">If you didn't ask to reset your password, ignore this email — your password stays unchanged. Never share this code with anyone, including someone claiming to be from ZUP TECH.</p>
</div>`,
  };
}
