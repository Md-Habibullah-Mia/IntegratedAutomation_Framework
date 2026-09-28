// Third exploration pass: the invitee side, end to end, in one run.
// Firm admin invites a beneficiary (plus-address of the QA inbox) to the
// exploration case → invitation email → accept → register → OTP email →
// verify → wherever the app lands. Records every step's aria snapshot.
//
//   CASE_ID=8 npx ts-node --transpile-only -r tsconfig-paths/register scripts/attorney-explore3.ts
import * as fs from 'fs';
import { chromium, Page } from '@playwright/test';
import { config } from '../src/config/env.config';
import { codeFrom, linkFrom, plusAddress, waitForEmail } from '../src/utils/gmail-inbox';

const OUT = 'reports/attorney-explore';
const CASE_ID = process.env.CASE_ID || '8';

async function aria(page: Page, name: string) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const snap = await page.locator('body').ariaSnapshot();
  fs.writeFileSync(`${OUT}/${name}.aria.yml`, snap);
  console.log(`\n===== ${name} (${page.url()})\n${snap.slice(0, 2000)}`);
}

(async () => {
  const browser = await chromium.launch();
  const admin = await (await browser.newContext({ baseURL: config.attorneyWebBaseUrl })).newPage();
  await admin.goto('/login?role=firm', { waitUntil: 'networkidle' });
  await admin.locator('input[type="email"]').fill(process.env.ATTORNEY_FIRM_ADMIN_EMAIL!);
  await admin.locator('input[autocomplete="current-password"]').fill(process.env.ATTORNEY_FIRM_ADMIN_PASSWORD!);
  await admin.getByRole('button', { name: 'Secure Login' }).click();
  await admin.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 });

  const invitee = plusAddress(`ben${Date.now()}`);
  const password = `Qa${Math.random().toString(36).slice(2, 8)}9!Zx`;
  fs.writeFileSync(`${OUT}/explore3-invitee.txt`, `${invitee}\n${password}\n`);
  const since = new Date();
  await admin.goto(`/cases/${CASE_ID}/team`, { waitUntil: 'networkidle' });
  await admin.getByRole('combobox', { name: 'Invitee role' }).selectOption('Beneficiary');
  await admin.getByPlaceholder('invitee@example.com').fill(invitee);
  await admin.getByPlaceholder('First name (optional)').fill('QA');
  await admin.getByPlaceholder('Last name (optional)').fill('Explore');
  await admin.getByRole('button', { name: 'Send invitation' }).click();
  await admin.getByText(`Invitation sent to ${invitee}.`).waitFor({ timeout: 20_000 });
  console.log('Invited', invitee);

  const inviteMail = await waitForEmail(invitee, { since });
  console.log(`\nINVITE EMAIL: "${inviteMail.subject}"\n${inviteMail.text.slice(0, 1500)}`);
  const link = linkFrom(inviteMail, /invite\/accept|login\?next=/);
  console.log('LINK', link);

  const client = await (await browser.newContext({ baseURL: config.attorneyWebBaseUrl })).newPage();
  await client.goto(link, { waitUntil: 'networkidle' });
  await aria(client, '20-invite-accept');
  await client.getByRole('button', { name: /Accept Invitation/ }).click();
  await client.waitForURL(/\/register/, { timeout: 20_000 });
  await client.waitForLoadState('networkidle');
  await aria(client, '21-register-from-invite');

  const otpSince = new Date();
  await client.getByPlaceholder('Password').fill(password);
  await client.getByRole('button', { name: /Create Secure Account|Create|Register/ }).first().click();
  await client.waitForURL(/\/verify/, { timeout: 30_000 });
  await aria(client, '22-verify-invitee');

  const otpMail = await waitForEmail(invitee, { since: otpSince, subject: /code|verif/i });
  const code = codeFrom(otpMail);
  console.log(`\nOTP EMAIL: "${otpMail.subject}" code=${code}`);
  for (let i = 1; i <= 6; i += 1) await client.getByLabel(`Verification digit ${i}`).fill(code[i - 1]);
  const verifyBtn = client.getByRole('button', { name: 'Verify Code' });
  if (await verifyBtn.isVisible().catch(() => false)) await verifyBtn.click({ timeout: 5_000 }).catch(() => {}); // auto-submits on the 6th digit
  await client.waitForTimeout(8000);
  await aria(client, '23-after-verify');
  if (/\/login/.test(client.url())) {
    await client.locator('input[type="email"]').fill(invitee);
    await client.locator('input[autocomplete="current-password"]').fill(password);
    await client.getByRole('button', { name: 'Secure Login' }).click();
    await client.waitForTimeout(8000);
    await aria(client, '24-after-invitee-login');
  }

  await admin.goto(`/cases/${CASE_ID}/team`, { waitUntil: 'networkidle' });
  await aria(admin, '25-case-team-after-accept');
  await admin.goto(`/cases/${CASE_ID}`, { waitUntil: 'networkidle' });
  await aria(admin, '26-case-detail-after-accept');
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
