import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Reads test emails (invitations, OTP codes) from the shared QA Gmail inbox
// over IMAP. Test addresses are plus-addresses of that inbox
// (user+tag@gmail.com), so every run gets unique recipients that still land
// here. Needs ATTORNEY_MAIL_USER / ATTORNEY_MAIL_APP_PASSWORD (a Gmail App
// Password) in .env.dev.local.

export interface InboxMessage {
  subject: string;
  text: string;
  html: string;
  date: Date;
}

const USER = process.env.ATTORNEY_MAIL_USER;
const PASS = process.env.ATTORNEY_MAIL_APP_PASSWORD;

export const inboxConfigured = () => Boolean(USER && PASS);

/** user@gmail.com → user+<tag>@gmail.com */
export const plusAddress = (tag: string) => USER!.replace('@', `+${tag}@`);

/**
 * Polls the inbox until a message addressed to `to` (and matching `subject`,
 * if given) arrives after `since`. Read-only: nothing is marked or deleted.
 */
export async function waitForEmail(
  to: string,
  { subject, since = new Date(Date.now() - 60_000), timeoutMs = 120_000 }: { subject?: RegExp; since?: Date; timeoutMs?: number } = {},
): Promise<InboxMessage> {
  const deadline = Date.now() + timeoutMs;
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: USER!, pass: PASS! }, logger: false });
  await client.connect();
  try {
    // "All Mail" catches everything filed away from the inbox except Spam —
    // and Gmail does spam-file app emails after a burst of test invites.
    const boxes = await client.list();
    const folders = [
      boxes.find((b) => b.specialUse === '\\All')?.path ?? 'INBOX',
      boxes.find((b) => b.specialUse === '\\Junk')?.path,
    ].filter((p): p is string => Boolean(p));
    const wanted = to.toLowerCase();
    // 2 min slack: the local clock and Gmail's can disagree by seconds, and
    // recipients are unique per run anyway.
    const notBefore = since.getTime() - 120_000;
    while (Date.now() < deadline) {
      // Re-open each poll so new arrivals are visible. Scan the newest
      // envelopes instead of IMAP SEARCH: Gmail's search index lags new mail,
      // so SEARCH TO can miss a message that is already there.
      for (const folder of folders) {
        const box = await client.mailboxOpen(folder, { readOnly: true });
        const hits: { uid: number; date: number }[] = [];
        if (box.exists > 0) {
          for await (const m of client.fetch(`${Math.max(1, box.exists - 24)}:*`, { envelope: true, internalDate: true, uid: true })) {
            const date = new Date(m.internalDate as Date).getTime();
            const toMatch = (m.envelope?.to ?? []).some((a) => a.address?.toLowerCase() === wanted);
            const subjectMatch = !subject || subject.test(m.envelope?.subject ?? '');
            if (toMatch && subjectMatch && date >= notBefore) hits.push({ uid: m.uid, date });
          }
        }
        const newest = hits.sort((a, b) => b.date - a.date)[0];
        if (newest) {
          const msg = await client.fetchOne(String(newest.uid), { source: true }, { uid: true });
          const parsed = await simpleParser((msg as { source: Buffer }).source);
          return { subject: parsed.subject ?? '', text: parsed.text ?? '', html: String(parsed.html || ''), date: parsed.date ?? new Date() };
        }
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
  } finally {
    await client.logout().catch(() => {});
  }
  throw new Error(`No email to ${to}${subject ? ` matching ${subject}` : ''} within ${timeoutMs / 1000}s`);
}

/** First link in the message whose URL matches `pattern`. */
export function linkFrom(msg: InboxMessage, pattern: RegExp): string {
  const urls = `${msg.html} ${msg.text}`.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  const url = urls.map((u) => u.replace(/&amp;/g, '&')).find((u) => pattern.test(u));
  if (!url) throw new Error(`No link matching ${pattern} in "${msg.subject}"`);
  return url;
}

/** First standalone 6-digit code (Cognito verification emails). */
export function codeFrom(msg: InboxMessage): string {
  const code = `${msg.text} ${msg.html.replace(/<[^>]+>/g, ' ')}`.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No 6-digit code in "${msg.subject}"`);
  return code;
}
