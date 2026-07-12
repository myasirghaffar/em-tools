import type { Env } from '../types';
import { AppError } from './app-error';
import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';

export async function sendTransactionalEmail(
  env: Env,
  opts: { to: string; subject: string; html: string },
): Promise<void> {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!key || !from) {
    throw new AppError(
      ErrorCodes.AUTH_EMAIL_NOT_CONFIGURED,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      'Email is not configured (RESEND_API_KEY and EMAIL_FROM).',
    );
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: stripHtmlForText(opts.html),
    }),
  });

  const bodyText = await res.text().catch(() => '');

  if (!res.ok) {
    throw new AppError(
      ErrorCodes.AUTH_EMAIL_SEND_FAILED,
      HttpStatusCode.BAD_GATEWAY,
      bodyText || `Resend returned HTTP ${res.status}`,
    );
  }

  try {
    const data = JSON.parse(bodyText) as { id?: string };
    if (data?.id) {
      console.info('[email] Resend accepted message', { id: data.id, to: opts.to });
    }
  } catch {
    /* ignore non-JSON success bodies */
  }
}

function stripHtmlForText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}
