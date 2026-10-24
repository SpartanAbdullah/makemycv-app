/**
 * Transactional email via Resend (2026-10-24). Used for the double opt-in
 * confirmation of the tips list and, later, the tips themselves. Server-only.
 *
 * Absent RESEND_API_KEY is a soft state: `emailConfigured()` is false and the
 * sign-up route answers 503 so the form hides itself — no half-collected
 * list of unconfirmed addresses.
 */

const KEY = process.env.RESEND_API_KEY;
// Overridable only so a local mock can stand in for Resend during e2e runs.
const API = process.env.RESEND_API_URL || "https://api.resend.com";
export const EMAIL_FROM = process.env.EMAIL_FROM || "MakeMyCV <hello@makemycv.ae>";

export const emailConfigured = (): boolean => Boolean(KEY);

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}): Promise<void> {
  if (!KEY) throw new Error("Email is not configured");
  const res = await fetch(`${API}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text, html: input.html, headers: input.headers }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend → ${res.status} ${text.slice(0, 200)}`);
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function confirmEmail(confirmUrl: string): { subject: string; text: string; html: string } {
  const subject = "Confirm your MakeMyCV tips";
  const text =
    "One tap to confirm you want UAE job-search tips from MakeMyCV, about twice a month:\n\n" +
    `${confirmUrl}\n\n` +
    "If you didn't ask for this, ignore this email — nothing is stored unless you confirm.\n\n— Abdullah, MakeMyCV";
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0B0F0C;max-width:520px">` +
    `<p>One tap to confirm you want UAE job-search tips from MakeMyCV, about twice a month.</p>` +
    `<p style="margin:24px 0"><a href="${escape(confirmUrl)}" style="background:#0E7C4A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">Yes, send me the tips</a></p>` +
    `<p style="color:#6B7368;font-size:14px">If you didn't ask for this, ignore this email — nothing is stored unless you confirm.</p>` +
    `<p style="color:#6B7368;font-size:14px">— Abdullah, MakeMyCV</p></div>`;
  return { subject, text, html };
}
