import type { ContactMessageRow } from '../db/schema';
import type { Database } from '../db/client';
import { UserRole } from '../common/constants/roles.enum';
import * as usersRepo from '../db/users.repo';
import type { Env } from '../types';
import { sendTransactionalEmail } from './mail';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function frontendBase(env: Env): string {
  return (env.FRONTEND_APP_URL ?? 'https://www.energymart.pk').replace(/\/$/, '');
}

async function resolveAdminNotifyEmail(db: Database, env: Env): Promise<string | null> {
  const fromEnv = env.ADMIN_NOTIFY_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  const admins = await usersRepo.listUsersByRole(db, UserRole.ADMIN);
  const active = admins.find((u) => u.isActive && u.email?.trim());
  return active?.email.trim().toLowerCase() ?? null;
}

export async function sendContactMessageEmails(
  env: Env,
  db: Database,
  row: ContactMessageRow,
): Promise<void> {
  const hasResend = Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
  if (!hasResend) {
    console.warn('[contact] RESEND_API_KEY + EMAIL_FROM not set — skipping notification emails');
    return;
  }

  const name = row.name.trim();
  const email = row.email.trim().toLowerCase();
  const phone = row.phone.trim();
  const subject = row.subject.trim();
  const message = row.message.trim();
  const adminUrl = `${frontendBase(env)}/contact-messages`;

  const userHtml = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for contacting EnergyMart. We received your message and will get back to you soon.</p>
    <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <p style="color:#666;font-size:13px;">If you did not send this, you can ignore this email.</p>
  `;

  await sendTransactionalEmail(env, {
    to: email,
    subject: 'We received your message — EnergyMart',
    html: userHtml,
  });

  const adminTo = await resolveAdminNotifyEmail(db, env);
  if (!adminTo) {
    console.warn('[contact] No ADMIN_NOTIFY_EMAIL or active admin user — admin notification skipped');
    return;
  }

  const adminHtml = `
    <p><strong>New contact form submission</strong> (#${row.id})</p>
    <table style="border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td>${escapeHtml(name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      ${phone ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Phone</td><td>${escapeHtml(phone)}</td></tr>` : ''}
      <tr><td style="padding:4px 12px 4px 0;color:#666;">Subject</td><td>${escapeHtml(subject)}</td></tr>
    </table>
    <p style="margin-top:12px;"><strong>Message</strong></p>
    <p style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(message)}</p>
    <p><a href="${adminUrl}" style="display:inline-block;padding:12px 20px;background:#FF7A00;color:#fff;text-decoration:none;border-radius:8px;">View in admin</a></p>
  `;

  await sendTransactionalEmail(env, {
    to: adminTo,
    subject: `Contact form: ${subject}`,
    html: adminHtml,
  });
}
