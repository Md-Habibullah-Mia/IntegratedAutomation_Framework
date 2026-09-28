import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '@web/attorney/pages/auth.pages';
import { plusAddress } from '@utils/gmail-inbox';

// LexVerify — Firm Admin test cases (docs/attorney/LexVerify_Test_Cases.xlsx),
// High priority first, in plan order. One login for the whole file (the
// framework's rule): a serial describe shares a single signed-in page.
//
// Data created on the pilot is all inside the test firm-admin's own firm:
// one "QA Auto" case per run and invitations to plus-addresses of the QA test
// inbox (ATTORNEY_MAIL_USER, e.g. pulseapktester+<role><ts>@gmail.com), unique per run so a
// re-run never collides with a previous pending invitation.
//
// Tests tagged "(bug)" assert correct behaviour the app does not have yet.
// They are marked test.fail() so the serial chain keeps running; once the app
// is fixed they "unexpectedly pass" — then drop the test.fail() line.

const EMAIL = process.env.ATTORNEY_FIRM_ADMIN_EMAIL;
const PASSWORD = process.env.ATTORNEY_FIRM_ADMIN_PASSWORD;
const RUN = Date.now();
const plus = (tag: string) => (process.env.ATTORNEY_MAIL_USER ? plusAddress(`${tag}${RUN}`) : EMAIL!.replace('@', `+${tag}${RUN}@`));

/**
 * These forms use type="email" / required inputs inside a <form>, so the
 * browser's own validation bubble blocks submit before the app's validation
 * runs. To check the app's messages, turn native validation off first.
 */
async function bypassNativeValidation(page: Page) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.locator('form').evaluateAll((forms: any[]) => forms.forEach((f) => f.setAttribute('novalidate', '')));
}

test.describe.serial('LexVerify — Firm Admin', () => {
  test.skip(!EMAIL || !PASSWORD, 'ATTORNEY_FIRM_ADMIN_EMAIL / _PASSWORD not set in .env.dev.local');

  let page: Page;
  let caseId = '';
  let landedOn = '';
  let beneficiaryInvitee = '';
  const firmInvite: Partial<Record<'Attorney' | 'Paralegal', { link: string; screen: string }>> = {};
  const caseName = `QA Auto – H-1B ${RUN}`;

  test.beforeAll(async ({ browser, baseURL }) => {
    page = await (await browser.newContext({ baseURL })).newPage();
    const login = new LoginPage(page);
    await login.goto('firm');
    await login.login(EMAIL!, PASSWORD!);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 });
    landedOn = new URL(page.url()).pathname;
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  const open = async (path: string) => page.goto(path, { waitUntil: 'networkidle' });

  // ---------------------------------------------------------------- High
  test('LGN-007 - Firm Admin login lands on the dashboard', async () => {
    expect(landedOn).toBe('/dashboard');
  });

  test('DSH-001 - Firm dashboard loads with navigation', async () => {
    await open('/dashboard');
    await expect(page.getByText(/Welcome back,/)).toBeVisible();
    for (const link of ['Dashboard', 'Cases', 'Tasks', 'Team']) {
      await expect(page.getByRole('link', { name: link, exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Firm Administrator')).toBeVisible();
  });

  test('DSH-002 - Firm Admin sees the New Case action', async () => {
    await open('/dashboard');
    await expect(page.getByRole('button', { name: '+ New Case' })).toBeVisible();
  });

  test('CASE-001 - Create case page layout', async () => {
    await open('/cases/new');
    await expect(page.getByRole('heading', { name: 'Create a new case' })).toBeVisible();
    await expect(page.getByPlaceholder('Doe — EB-1A Petition')).toBeVisible();
    await expect(page.getByTestId('case-type-select')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create case' })).toBeVisible();
  });

  test('CASE-002 - Case name is required', async () => {
    await open('/cases/new');
    await page.getByTestId('case-type-select').selectOption({ label: 'H-1B Petitioner (I-129)' });
    await page.getByRole('button', { name: 'Create case' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Case name is required.' })).toBeVisible();
    await expect(page).toHaveURL(/\/cases\/new$/);
  });

  test('CASE-003 - Case type is required', async () => {
    await open('/cases/new');
    await page.getByPlaceholder('Doe — EB-1A Petition').fill('QA type missing');
    // The <select> is also HTML-required; bypass the native bubble so the
    // app's own validation message is what's checked.
    await bypassNativeValidation(page);
    await page.getByRole('button', { name: 'Create case' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Case type is required.' })).toBeVisible();
  });

  test('CASE-004 - Seeded case types are offered', async () => {
    await open('/cases/new');
    const options = await page.getByTestId('case-type-select').locator('option').allInnerTexts();
    expect(options).toEqual(expect.arrayContaining(['Adjustment of Status (I-485)', 'H-1B Petitioner (I-129)']));
  });

  test('CASE-005 - Create a case → draft case, lands on its team page', async () => {
    await open('/cases/new');
    await page.getByPlaceholder('Doe — EB-1A Petition').fill(caseName);
    await page.getByTestId('case-type-select').selectOption({ label: 'H-1B Petitioner (I-129)' });
    await page.getByRole('button', { name: 'Create case' }).click();
    await page.waitForURL(/\/cases\/\d+\/team/, { timeout: 30_000 });
    caseId = page.url().match(/cases\/(\d+)/)![1];
    await expect(page.getByRole('heading', { name: caseName })).toBeVisible();
    await expect(page.getByText(/This case has no team yet/).first()).toBeVisible();
  });

  test('CTM-001 - New draft case shows the empty-team message', async () => {
    await open(`/cases/${caseId}/team`);
    await expect(page.getByText('No team members yet. Use the form above to add the first invitee.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add invitee' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assign existing firm member' })).toBeVisible();
  });

  test('CTM-004 - Invalid invitee email is rejected', async () => {
    await open(`/cases/${caseId}/team`);
    // Native type="email" validation blocks "invitee@" first — assert that,
    // then bypass it to check the app's own message.
    await page.getByPlaceholder('invitee@example.com').fill('invitee@');
    expect(await page.getByPlaceholder('invitee@example.com').evaluate((el: any) => el.checkValidity())).toBe(false);
    await bypassNativeValidation(page);
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText('Invalid email: invitee@')).toBeVisible();

    await page.getByPlaceholder('invitee@example.com').fill('');
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText('Email is required.')).toBeVisible();
  });

  test('CTM-002 - Invite a beneficiary to the case', async () => {
    const invitee = plus('client');
    await open(`/cases/${caseId}/team`);
    await page.getByRole('combobox', { name: 'Invitee role' }).selectOption('Beneficiary');
    await page.getByPlaceholder('invitee@example.com').fill(invitee);
    await page.getByPlaceholder('First name (optional)').fill('QA');
    await page.getByPlaceholder('Last name (optional)').fill('Beneficiary');
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && /invitation/i.test(r.url()), { timeout: 30_000 });
    await page.getByRole('button', { name: 'Send invitation' }).click();
    expect((await created).status()).toBeLessThan(300);
    await expect(page.getByText(`Invitation sent to ${invitee}.`)).toBeVisible({ timeout: 20_000 });
    beneficiaryInvitee = invitee;
  });

  test('CTM-010 (bug) - Pending invitee is listed on the case team page', async () => {
    test.fail(true, 'Known app bug — see Actual Result in the TC workbook; remove when fixed');
    // The page says "Firm admins can resend pending invitations" and the
    // onboarding doc says a stuck invite is re-sent "from the team page", but
    // the pending invitee never appears — the table stays "No team members yet".
    await open(`/cases/${caseId}/team`);
    await expect(page.getByText(beneficiaryInvitee).first()).toBeVisible({ timeout: 15_000 });
  });

  test('CTM-003 - Invite a petitioner to the case', async () => {
    const invitee = plus('petitioner');
    await open(`/cases/${caseId}/team`);
    await page.getByRole('combobox', { name: 'Invitee role' }).selectOption('Petitioner');
    await page.getByPlaceholder('invitee@example.com').fill(invitee);
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText(`Invitation sent to ${invitee}.`)).toBeVisible({ timeout: 20_000 });
  });

  test('CASE-008 - Case list shows the new case as Draft', async () => {
    await open('/cases');
    const row = page.getByRole('row').filter({ hasText: caseName });
    await expect(row).toBeVisible();
    await expect(row).toContainText('H-1B Petitioner (I-129)');
    await expect(row).toContainText('Draft');
  });

  test('CASE-009 - Case detail page shows sections and draft status', async () => {
    await open(`/cases/${caseId}`);
    await expect(page.getByRole('heading', { name: caseName })).toBeVisible();
    for (const tab of ['Overview', 'Team', 'Questionnaires', 'Tasks']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
    await expect(page.getByText('draft', { exact: true })).toBeVisible();
  });

  test('QNR-001 - Questionnaires tab offers "Add questionnaire"', async () => {
    await open(`/cases/${caseId}/questionnaires`);
    await expect(page.getByRole('button', { name: 'Add questionnaire' })).toBeVisible();
  });

  test('QNR-002 - Questionnaire needs an active beneficiary/petitioner', async () => {
    await open(`/cases/${caseId}/questionnaires`);
    await page.getByRole('button', { name: 'Add questionnaire' }).first().click();
    await expect(page.getByText(/This case has no active beneficiary or petitioner yet/)).toBeVisible();
  });

  test('DOC-001 - Documents are gated until a questionnaire exists', async () => {
    await open(`/cases/${caseId}/documents`);
    await expect(page.getByRole('heading', { name: 'Questionnaire required before document collection' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Attach Questionnaire →' })).toBeVisible();
  });

  test('TEAM-001 - Team page lists members with search and Add Team Member', async () => {
    await open('/team-member');
    await expect(page.getByRole('heading', { name: 'Team Management' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search team members' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Team Member/ })).toBeVisible();
  });

  test('TEAM-004 - Invalid invite email is not submitted', async () => {
    await open('/team-member');
    await page.getByRole('button', { name: /Add Team Member/ }).click();
    const invites: string[] = [];
    page.on('request', (r) => r.method() === 'POST' && /invitation/i.test(r.url()) && invites.push(r.url()));
    await page.getByPlaceholder('Enter first name').fill('QA');
    await page.getByPlaceholder('Enter email address').fill('not-an-email');
    await page.getByRole('dialog').or(page.locator('form')).locator('select').last().selectOption('Attorney').catch(() => {});
    await page.getByRole('button', { name: 'Add Team Member', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Add Team Member' })).toBeVisible(); // dialog stays open
    expect(invites).toHaveLength(0);
    await page.getByRole('button', { name: '✕' }).click();
  });

  for (const role of ['Attorney', 'Paralegal'] as const) {
    test(`TEAM-00${role === 'Attorney' ? 2 : 3} - Invite a ${role} to the firm`, async () => {
      const invitee = plus(role.toLowerCase());
      await open('/team-member');
      await page.getByRole('button', { name: /Add Team Member/ }).click();
      await page.getByPlaceholder('Enter first name').fill('QA');
      await page.getByPlaceholder('Enter last name').fill(role);
      await page.getByPlaceholder('Enter email address').fill(invitee);
      await page.locator('select:has(option:text("Select role"))').selectOption(role);
      const created = page.waitForResponse((r) => r.request().method() === 'POST' && /invitation/i.test(r.url()), { timeout: 30_000 });
      await page.getByRole('button', { name: 'Add Team Member', exact: true }).last().click();
      expect((await created).status()).toBeLessThan(300);
      await expect(page.getByRole('heading', { name: 'Invitation Generated Successfully' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(invitee)).toBeVisible();
      firmInvite[role] = {
        link: await page.getByRole('textbox').first().inputValue(),
        screen: await page.locator('body').innerText(),
      };
    });
  }

  test('TEAM-013 (bug) - Firm invite screen shows a usable invite link', async () => {
    test.fail(true, 'Known app bug — see Actual Result in the TC workbook; remove when fixed');
    // Actual: "Unique Invite Link" is http://…/invite/accept?token=null
    expect(firmInvite.Attorney?.link).toMatch(/\/invite\/accept\?token=(?!null$)[\w-]{8,}/);
  });

  test('TEAM-014 (bug) - Firm invite screen shows the role that was chosen', async () => {
    test.fail(true, 'Known app bug — see Actual Result in the TC workbook; remove when fixed');
    // Actual: Access Role reads "Standard User" for an Attorney/Paralegal invite.
    expect(firmInvite.Attorney?.screen).toMatch(/Access Role\s*Attorney/);
  });

  test('CASE-014 - Non-existent case id shows a not-found state', async () => {
    await open('/cases/99999999');
    await expect(page.getByText(/not found|does not exist|404/i).first()).toBeVisible({ timeout: 20_000 });
  });

  // ------------------------------------------------------ Found bugs (fail on purpose)
  test('DSH-005 (bug) - Empty firm dashboard shows no fabricated hearings', async () => {
    test.fail(true, 'Known app bug — see Actual Result in the TC workbook; remove when fixed');
    await open('/dashboard');
    await expect(page.getByText(/priority hearings this week/)).toHaveCount(0);
  });

  test('TEAM-011 (bug) - Team page header shows the signed-in user, not a placeholder', async () => {
    test.fail(true, 'Known app bug — see Actual Result in the TC workbook; remove when fixed');
    await open('/team-member');
    await expect(page.getByText('Sarah Jenkins')).toHaveCount(0);
  });

  test('CASE-015 (bug) - Case detail shows no developer TODO text', async () => {
    test.fail(true, 'Known app bug — see Actual Result in the TC workbook; remove when fixed');
    await open(`/cases/${caseId}`);
    await expect(page.getByText(/TODO \(product\)/)).toHaveCount(0);
  });

  // ---------------------------------------------------------------- Last: ends the session
  test('SES-003 - Sign out ends the session', async () => {
    await open('/dashboard');
    await page.getByRole('button', { name: /Sign out/ }).first().click();
    await page.waitForURL(/\/(login|$)/, { timeout: 20_000 }).catch(() => {});
    await open('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
