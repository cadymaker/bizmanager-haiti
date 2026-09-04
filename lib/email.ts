// lib/email.ts
// Imèl tranzaksyonèl via Resend. Sèvi sou sèvè a sèlman.
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// An pwodiksyon, sèvi ak yon adrès sou yon domèn ki verifye nan Resend.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'BizManager <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.bizmanagerhaiti.com';

export async function sendLicenseConfirmationEmail(params: {
  to: string;
  planLabel: string;
  amount: number;
  expiryDate: Date;
}): Promise<{ sent: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY manke' };
  if (!params.to) return { sent: false, error: 'pa gen adrès imèl' };

  const resend = new Resend(RESEND_API_KEY);
  const fmtAmount = new Intl.NumberFormat('fr-HT').format(params.amount) + ' HTG';
  const fmtExpiry = params.expiryDate.toLocaleDateString('fr-HT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f7;padding:24px;margin:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#2563eb;padding:20px 24px;">
          <span style="color:#ffffff;font-size:18px;font-weight:bold;">BizManager Haiti</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Peman ou konfime ✓</h1>
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">
            Mèsi. Lisans BizManager ou an aktive kounye a.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:0 0 20px;">
            <tr>
              <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Plan</td>
              <td style="padding:12px 16px;text-align:right;color:#111827;font-size:13px;font-weight:bold;">${params.planLabel}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-top:1px solid #edf0f7;">Montan</td>
              <td style="padding:12px 16px;text-align:right;color:#111827;font-size:13px;font-weight:bold;border-top:1px solid #edf0f7;">${fmtAmount}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-top:1px solid #edf0f7;">Valab jiska</td>
              <td style="padding:12px 16px;text-align:right;color:#111827;font-size:13px;font-weight:bold;border-top:1px solid #edf0f7;">${fmtExpiry}</td>
            </tr>
          </table>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:bold;">Ale nan dashboard</a>
          <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">
            Si se pa ou ki te fè peman sa a, tanpri kontakte nou touswit.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f9fafb;color:#9ca3af;font-size:11px;text-align:center;">
          BizManager Haiti · Cadymaker Services
        </td>
      </tr>
    </table>
  </div>`;

  const text =
    `Peman ou konfime! Lisans BizManager ou an aktive.\n\n` +
    `Plan: ${params.planLabel}\nMontan: ${fmtAmount}\nValab jiska: ${fmtExpiry}\n\n` +
    `Ale nan dashboard: ${APP_URL}/dashboard`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: 'Konfimasyon peman — Lisans BizManager',
      html,
      text,
    });
    if (error) {
      const message = (error as { message?: string }).message ?? JSON.stringify(error);
      return { sent: false, error: message };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'erè enkoni' };
  }
}