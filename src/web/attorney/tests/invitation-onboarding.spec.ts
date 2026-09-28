import { APIRequestContext, Browser, expect, Page, request, test } from '@playwright/test';
import { config } from '@config/env.config';
import { ForgotPasswordPage, LoginPage, RegisterPage, VerifyPage } from '@web/attorney/pages/auth.pages';
import { codeFrom, inboxConfigured, InboxMessage, linkFrom, plusAddress, waitForEmail } from '@utils/gmail-inbox';

// LexVerify — invitation → sign-up → role access, end to end with real email.
//
// The firm admin (ATTORNEY_FIRM_ADMIN_*) creates one case and invites a
// beneficiary and an attorney. Invitees are plus-addresses of the QA Gmail
// inbox (ATTORNEY_MAIL_*), unique per run; their invitation links and OTP
// codes are read over IMAP. Each role signs in once and the whole file runs
// as one serial chain, since every step builds on the previous one.
//
// Tests tagged "(bug)" are marked test.fail(): they assert what the app
// should do and pass only once the bug is fixed.

const ADMIN_EMAIL = process.env.ATTORNEY_FIRM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ATTORNEY_FIRM_ADMIN_PASSWORD;
const RUN = Date.now();
const newPassword = () => `Qa${Math.random().toString(36).slice(2, 8)}9!Zx`;
const BUG = 'Known app bug — see Actual Result in the TC workbook; remove when fixed';

async function freshPage(browser: Browser, baseURL?: string) {
  return (await browser.newContext({ baseURL })).newPage();
}

/** Access token the SPA keeps in localStorage after sign-in. */
async function tokenOf(page: Page): Promise<string> {
  const raw = (await page.evaluate(() => localStorage.getItem('lexverify_auth'))) ?? '';
  const token = raw.match(/"accessToken":"([^"]+)"/)?.[1];
  if (!token) throw new Error('No access token in localStorage');
  return token;
}

async function apiAs(page: Page): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: config.attorneyApiBaseUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${await tokenOf(page)}` },
  });
}

async function typeOtp(page: Page, code: string) {
  // /verify submits by itself once the 6th digit is in.
  await new VerifyPage(page).typeCode(code);
  const button = page.getByRole('button', { name: 'Verify Code' });
  if (await button.isVisible().catch(() => false)) await button.click({ timeout: 3_000 }).catch(() => {});
}

test.describe.serial('LexVerify — Invitations & role access', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'ATTORNEY_FIRM_ADMIN_EMAIL / _PASSWORD not set in .env.dev.local');
  test.skip(!inboxConfigured(), 'ATTORNEY_MAIL_USER / _APP_PASSWORD not set in .env.dev.local');
  test.setTimeout(180_000);

  let admin: Page;
  let caseId = '';
  let createCaseBody: unknown;
  const caseName = `QA Invite – H-1B ${RUN}`;

  const ben = { email: '', password: newPassword(), link: '', mail: undefined as InboxMessage | undefined };
  let client: Page;
  const atty = { email: '', password: newPassword() };
  let attorney: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    admin = await freshPage(browser, baseURL);
    const login = new LoginPage(admin);
    await login.goto('firm');
    await login.login(ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await admin.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 });

    await admin.goto('/cases/new', { waitUntil: 'networkidle' });
    await admin.getByPlaceholder('Doe — EB-1A Petition').fill(caseName);
    await admin.getByTestId('case-type-select').selectOption({ label: 'H-1B Petitioner (I-129)' });
    const created = admin.waitForRequest((r) => r.method() === 'POST' && /\/api\/v1\/cases$/.test(r.url()));
    await admin.getByRole('button', { name: 'Create case' }).click();
    createCaseBody = (await created).postDataJSON();
    await admin.waitForURL(/\/cases\/\d+\/team/, { timeout: 30_000 });
    caseId = admin.url().match(/cases\/(\d+)/)![1];
  });

  test.afterAll(async () => {
    for (const p of [admin, client, attorney]) await p?.context().close();
  });

  // ------------------------------------------------------------ Registration
  test('REG-008 - Already-registered email is rejected with a sign-in hint', async ({ browser, baseURL }) => {
    const page = await freshPage(browser, baseURL);
    const reg = new RegisterPage(page);
    await reg.goto();
    await reg.fillAndSubmit(ADMIN_EMAIL!, newPassword());
    await expect(reg.errors().first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`a[href^="/login?role=firm&email="]`)).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
    await page.context().close();
  });

  // ------------------------------------------------- Beneficiary: invitation
  test('INV-004 (1/4) - Beneficiary invitation email arrives with an accept link', async () => {
    ben.email = plusAddress(`ben${RUN}`);
    const since = new Date();
    await admin.goto(`/cases/${caseId}/team`, { waitUntil: 'networkidle' });
    await admin.getByRole('combobox', { name: 'Invitee role' }).selectOption('Beneficiary');
    await admin.getByPlaceholder('invitee@example.com').fill(ben.email);
    await admin.getByPlaceholder('First name (optional)').fill('QA');
    await admin.getByPlaceholder('Last name (optional)').fill('Beneficiary');
    await admin.getByRole('button', { name: 'Send invitation' }).click();
    await expect(admin.getByText(`Invitation sent to ${ben.email}.`)).toBeVisible({ timeout: 20_000 });

    ben.mail = await waitForEmail(ben.email, { since, subject: /invit/i });
    ben.link = linkFrom(ben.mail, /\/invite\/accept\?token=[\w-]{16,}/);
  });

  test('INV-011 (bug) - Invitation email names the case and firm, not raw ids', async () => {
    test.fail(true, BUG);
    // Actual: subject "You are invited to join Immigration Platform", body lists
    // "Role: client / Firm ID: 8 / Case ID: 8" and never the case name.
    expect(`${ben.mail!.subject}\n${ben.mail!.text}`).toContain(caseName);
    expect(ben.mail!.text).not.toMatch(/Firm ID:|Case ID:/);
  });

  test('REG-012 - Invite link pre-fills and locks the email on sign-up', async ({ browser, baseURL }) => {
    client = await freshPage(browser, baseURL);
    await client.goto(ben.link, { waitUntil: 'networkidle' });
    await expect(client.getByRole('heading', { name: "You've been invited" })).toBeVisible({ timeout: 20_000 });
    await expect(client.getByTestId('invite-email')).toHaveText(ben.email);
    await client.getByRole('button', { name: /Accept Invitation/ }).click();
    await client.waitForURL(/\/register\?token=/, { timeout: 20_000 });
    await client.waitForLoadState('networkidle');
    const reg = new RegisterPage(client);
    await expect(reg.email()).toHaveValue(ben.email);
    await expect(client.getByText("You've been invited to")).toBeVisible();
    expect(await reg.email().evaluate((el: any) => el.readOnly || el.disabled)).toBe(true);
  });

  test('REG-015 (bug) - Invitee sign-up banner shows the case name', async () => {
    test.fail(true, BUG);
    // Actual: "You've been invited to Case #<id>".
    await expect(client.getByText(caseName)).toBeVisible({ timeout: 5_000 });
  });

  test('REG-016 (bug) - Invitee sign-up page does not show firm-onboarding copy', async () => {
    test.fail(true, BUG);
    // Actual: a client invitee sees "Begin Firm Verification", "Onboarding Phase I",
    // "Secure your practice identity…" and "Already registered? Sign in to your firm".
    await expect(client.getByRole('heading', { name: 'Begin Firm Verification' })).toHaveCount(0);
  });

  test('REG-007 - Sign-up sends a 6-digit code and opens /verify', async () => {
    const since = new Date();
    await new RegisterPage(client).password().fill(ben.password);
    await new RegisterPage(client).submit().click();
    await client.waitForURL(/\/verify/, { timeout: 30_000 });
    await expect(client.getByRole('heading', { name: 'Verify Your Identity' })).toBeVisible();
    ben.mail = await waitForEmail(ben.email, { since, subject: /verification code/i });
    expect(codeFrom(ben.mail)).toMatch(/^\d{6}$/);
  });

  test('OTP-005 - Wrong code is rejected and the cells are cleared', async () => {
    const wrong = codeFrom(ben.mail!) === '000000' ? '111111' : '000000';
    await typeOtp(client, wrong);
    await expect(new VerifyPage(client).errors().first()).toBeVisible({ timeout: 20_000 });
    await expect(client).toHaveURL(/\/verify/);
    await expect(new VerifyPage(client).digit(1)).toHaveValue('');
  });

  test('OTP-006 - Correct code confirms the account and opens login', async () => {
    await typeOtp(client, codeFrom(ben.mail!));
    await client.waitForURL(/\/login/, { timeout: 30_000 });
  });

  test('LGN-008 / INV-004 (4/4) - Beneficiary signs in, invitation is accepted, lands on invited workspace', async () => {
    await client.waitForLoadState('networkidle');
    await new LoginPage(client).login(ben.email, ben.password);
    await client.waitForURL(/\/invited-workspace/, { timeout: 45_000 });
    await expect(client.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  });

  test('ONB-002 - Invited workspace lists only the invited case', async () => {
    await expect(client.getByText('You have access to 1 case.')).toBeVisible();
    const row = client.getByRole('row', { name: new RegExp(caseName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('beneficiary');
    await expect(row).toContainText('active');
  });

  test('ONB-003 (bug) - Invited workspace shows the beneficiary name on the case row', async () => {
    test.fail(true, BUG);
    // Actual: the Beneficiary column shows "— —".
    await expect(client.getByRole('row', { name: new RegExp(caseName) }).getByRole('cell').first()).not.toHaveText(/^[\s—]+$/);
  });

  // -------------------------------------------------- Firm side after accept
  test('INV-007 / CTM-009 - First accepted client invite activates the draft case', async () => {
    await admin.goto(`/cases/${caseId}`, { waitUntil: 'networkidle' });
    await expect(admin.getByText('Active', { exact: true }).first()).toBeVisible();
    await admin.goto(`/cases/${caseId}/team`, { waitUntil: 'networkidle' });
    const row = admin.getByRole('row', { name: new RegExp(ben.email.replace(/[+.]/g, '\\$&')) });
    await expect(row).toContainText('beneficiary');
    await expect(row).toContainText('active');
  });

  test('CTM-011 (bug) - Member name uses the first/last name given on the invite', async () => {
    test.fail(true, BUG);
    // Actual: "Pulseapktester+ben<ts> User" — the QA / Beneficiary names are dropped.
    await expect(admin.getByRole('cell', { name: 'QA Beneficiary' })).toBeVisible({ timeout: 5_000 });
  });

  test('CASE-016 (bug) - Case overview counts the active team member', async () => {
    test.fail(true, BUG);
    // Actual: overview card says "Team members 0 — No one has access yet." while
    // the Team tab lists the active beneficiary.
    await admin.goto(`/cases/${caseId}`, { waitUntil: 'networkidle' });
    await expect(admin.getByText('No one has access yet.')).toHaveCount(0);
  });

  test('INV-003 / INV-010 (bug) - Used invitation token cannot be used again', async ({ browser, baseURL }) => {
    test.fail(true, BUG);
    // Actual: the accepted link still shows "You've been invited" with an
    // enabled "Accept Invitation" button.
    const page = await freshPage(browser, baseURL);
    test.info().setTimeout(60_000);
    await page.goto(ben.link, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Unable to Accept Invitation|Invitation Link Expired/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Accept Invitation/ })).toHaveCount(0);
    await page.context().close();
  });

  // ------------------------------------------------ Beneficiary access limits
  test('DSH-004 - Client cannot open the firm dashboard', async () => {
    // /dashboard renders a client view for clients (not a redirect): only the
    // client's own case, no firm controls.
    await client.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(client.getByRole('navigation', { name: 'Client navigation' })).toBeVisible();
    await expect(client.getByText('You have access to 1 case.')).toBeVisible();
    await expect(client.getByRole('button', { name: '+ New Case' })).toHaveCount(0);
    await expect(client.getByRole('link', { name: 'Team', exact: true })).toHaveCount(0);
  });

  test('CASE-013 / DOC-010 - Client cannot read another case of the firm', async () => {
    // Case the beneficiary was never invited to: the exploration case (or any other firm case).
    const api = await apiAs(client);
    const other = String(Number(caseId) === 8 ? 10 : 8);
    for (const path of [`/api/v1/cases/${other}`, `/api/v1/cases/${other}/documents`]) {
      expect([403, 404], `${path}`).toContain((await api.get(path)).status());
    }
    await api.dispose();
  });

  test('AI-005 - Client cannot reach AI extraction data', async () => {
    const api = await apiAs(client);
    const res = await api.get(`/api/v1/cases/${caseId}/extractions/pending-count`);
    expect(res.status()).toBe(403);
    await api.dispose();
  });

  // ------------------------------------------------------ Forgot password
  test('FPW-004 / FPW-007 - Reset password by emailed code, then only the new one works', async ({ browser, baseURL }) => {
    const page = await freshPage(browser, baseURL);
    const fp = new ForgotPasswordPage(page);
    await fp.goto();
    const since = new Date();
    await fp.email().fill(ben.email);
    await fp.sendCode().click();
    await expect(page.getByText('A 6-digit verification code was sent to')).toBeVisible({ timeout: 20_000 });
    const code = codeFrom(await waitForEmail(ben.email, { since, subject: /code|password|reset/i }));

    const fresh = newPassword();
    for (let i = 1; i <= 6; i += 1) await page.getByLabel(`Verification digit ${i}`).fill(code[i - 1]);
    await page.getByPlaceholder('At least 8 characters').fill(fresh);
    await page.getByPlaceholder('Re-enter your new password').fill(fresh);
    await page.getByRole('button', { name: 'Reset Password' }).click();
    await expect(page.getByText(/Your password has been updated successfully/)).toBeVisible({ timeout: 20_000 });

    const login = new LoginPage(page);
    await login.goto('client');
    await login.login(ben.email, ben.password);
    await expect(login.errors().first()).toBeVisible({ timeout: 20_000 });
    await login.password().fill(fresh);
    await login.submit().click();
    await page.waitForURL(/\/invited-workspace/, { timeout: 45_000 });
    ben.password = fresh;
    await page.context().close();
  });

  // ------------------------------------------------------ Attorney
  test('TEAM-002 / INV-004 (staff) - Invited attorney signs up and joins the firm', async ({ browser, baseURL }) => {
    atty.email = plusAddress(`atty${RUN}`);
    const since = new Date();
    await admin.goto('/team-member', { waitUntil: 'networkidle' });
    await admin.getByRole('button', { name: /Add Team Member/ }).click();
    await admin.getByPlaceholder('Enter first name').fill('QA');
    await admin.getByPlaceholder('Enter last name').fill('Attorney');
    await admin.getByPlaceholder('Enter email address').fill(atty.email);
    await admin.locator('select:has(option:text("Select role"))').selectOption('Attorney');
    await admin.getByRole('button', { name: 'Add Team Member', exact: true }).last().click();
    await expect(admin.getByRole('heading', { name: 'Invitation Generated Successfully' })).toBeVisible({ timeout: 20_000 });

    const link = linkFrom(await waitForEmail(atty.email, { since, subject: /invit/i }), /\/invite\/accept\?token=[\w-]{16,}/);
    attorney = await freshPage(browser, baseURL);
    await attorney.goto(link, { waitUntil: 'networkidle' });
    await attorney.getByRole('button', { name: /Accept Invitation/ }).click();
    await attorney.waitForURL(/\/register\?token=/, { timeout: 20_000 });
    await attorney.waitForLoadState('networkidle');
    const otpSince = new Date();
    await new RegisterPage(attorney).password().fill(atty.password);
    await new RegisterPage(attorney).submit().click();
    await attorney.waitForURL(/\/verify/, { timeout: 30_000 });
    await typeOtp(attorney, codeFrom(await waitForEmail(atty.email, { since: otpSince, subject: /verification code/i })));
    await attorney.waitForURL(/\/login/, { timeout: 30_000 });
    await attorney.waitForLoadState('networkidle');
    await new LoginPage(attorney).login(atty.email, atty.password);
    await attorney.waitForURL((u) => !/\/(login|invite)/.test(u.pathname), { timeout: 45_000 });
    await attorney.waitForLoadState('networkidle');
    expect(new URL(attorney.url()).pathname).toBe('/dashboard');
  });

  test('TEAM-005 - Attorney cannot invite firm staff', async () => {
    await attorney.goto('/team-member', { waitUntil: 'networkidle' });
    await expect(attorney.getByRole('button', { name: /Add Team Member/ })).toHaveCount(0);
  });

  test('CASE-007 - Attorney cannot create a case (API)', async () => {
    // Same body the firm admin's form sent — only the caller differs.
    const api = await apiAs(attorney);
    const res = await api.post('/api/v1/cases', { data: { ...(createCaseBody as object), case_name: `QA should-not-exist ${RUN}` } });
    expect(res.status()).toBe(403);
    await api.dispose();
  });

  test('DSH-006 (bug) - Attorney is not offered the New Case action', async () => {
    test.fail(true, BUG);
    // Actual: the attorney's dashboard shows "+ New Case" (Firm Admin only).
    await attorney.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(attorney.getByRole('button', { name: '+ New Case' })).toHaveCount(0);
  });

  test('CASE-012 (bug) - Attorney cannot open a case they are not assigned to', async () => {
    test.fail(true, BUG);
    // USER_ROLES_OVERVIEW: attorneys "can only act on cases they have been
    // assigned to". Actual: GET /api/v1/cases/<id> returns 200 with full details.
    const api = await apiAs(attorney);
    expect([403, 404]).toContain((await api.get(`/api/v1/cases/${caseId}`)).status());
    await api.dispose();
  });

  test('CTM-005 - Firm Admin assigns the attorney to the case, attorney gains access', async () => {
    await admin.goto(`/cases/${caseId}/team`, { waitUntil: 'networkidle' });
    await admin.getByRole('combobox', { name: 'Assign role' }).selectOption('Attorney');
    const member = admin.getByRole('combobox', { name: 'Select a firm member to assign' });
    await member.selectOption({ label: await member.locator('option', { hasText: /QA|atty/i }).first().innerText() });
    await admin.getByRole('button', { name: 'Assign to case' }).click();
    await expect(admin.getByRole('row', { name: /attorney/i })).toBeVisible({ timeout: 20_000 });

    const api = await apiAs(attorney);
    expect((await api.get(`/api/v1/cases/${caseId}`)).status()).toBe(200);
    await api.dispose();
  });
});
