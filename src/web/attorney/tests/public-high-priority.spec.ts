import { expect, request, test } from '@playwright/test';
import { config } from '@config/env.config';
import {
  ForgotPasswordPage,
  InviteAcceptPage,
  LandingPage,
  LoginPage,
  RegisterPage,
  VerifyPage,
} from '@web/attorney/pages/auth.pages';

// LexVerify — High-priority test cases that need no account, in the order
// of the "High Priority Plan" sheet of docs/attorney/LexVerify_Test_Cases.xlsx.
// All signed-out, so each test opens its own page (no shared login needed).
// Nothing here creates data on the pilot: registration/login attempts use
// inputs the client rejects before any request, or a non-existent account.

test.describe('LexVerify — Landing', () => {
  test('LND-001 - Landing page shows both access types', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.expectLoaded();
  });

  test('LND-002 - Individual option opens client login', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.individualCard().click();
    await expect(page).toHaveURL(/\/login\?role=individual/);
    const login = new LoginPage(page);
    await expect(login.subtitle('Access your personal immigration workspace.')).toBeVisible();
    await expect(login.registerFirmLink()).toHaveCount(0);
  });

  test('LND-003 - Law Firm option opens firm registration', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.firmCard().click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Begin Firm Verification' })).toBeVisible();
  });
});

test.describe('LexVerify — Registration (client-side validation)', () => {
  // Every case here is rejected before the form calls the API, so no
  // Cognito user or firm is ever created. The request watcher proves it.
  let registerCalls: string[];
  test.beforeEach(async ({ page }) => {
    registerCalls = [];
    page.on('request', (r) => {
      if (r.url().includes('/auth/register')) registerCalls.push(r.url());
    });
  });

  test('REG-001 - Registration page renders', async ({ page }) => {
    const reg = new RegisterPage(page);
    await reg.goto();
    await expect(page.getByRole('heading', { name: 'Begin Firm Verification' })).toBeVisible();
    await expect(page.getByText('Onboarding Phase I')).toBeVisible();
    await expect(reg.email()).toBeVisible();
    await expect(reg.password()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms of Protocol' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in to your firm' })).toHaveAttribute('href', '/login?role=firm');
  });

  test('REG-002 - Empty email and password are rejected', async ({ page }) => {
    const reg = new RegisterPage(page);
    await reg.goto();
    await reg.submit().click();
    await expect(reg.errors().filter({ hasText: 'Work email is required.' })).toBeVisible();
    await expect(reg.errors().filter({ hasText: 'Password is required.' })).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    expect(registerCalls).toHaveLength(0);
  });

  for (const bad of ['abc@xyz', 'abc.com', 'a b@c.com']) {
    test(`REG-003 - Invalid email format is rejected: "${bad}"`, async ({ page }) => {
      const reg = new RegisterPage(page);
      await reg.goto();
      await reg.fillAndSubmit(bad, 'Valid@1234');
      await expect(reg.errors().filter({ hasText: 'Enter a valid email.' })).toBeVisible();
      expect(registerCalls).toHaveLength(0);
    });
  }

  test('REG-004 - Password shorter than 8 characters is rejected', async ({ page }) => {
    const reg = new RegisterPage(page);
    await reg.goto();
    await reg.fillAndSubmit('qa.short.pw@example.com', 'Ab1!xyz');
    await expect(reg.errors().filter({ hasText: 'Minimum 8 characters.' })).toBeVisible();
    expect(registerCalls).toHaveLength(0);
  });
});

test.describe('LexVerify — Email verification (OTP)', () => {
  test('OTP-001 - Verify page layout', async ({ page }) => {
    const verify = new VerifyPage(page);
    await verify.goto();
    await expect(page.getByText('A 6-digit code has been sent to your email')).toBeVisible();
    for (let i = 1; i <= 6; i += 1) await expect(verify.digit(i)).toBeVisible();
    await expect(verify.verifyButton()).toBeVisible();
    await expect(page.getByRole('button', { name: /Resend in 0[01]:\d\d/ })).toBeDisabled();
    await expect(page.getByRole('link', { name: /Back to Registration/ })).toBeVisible();
  });

  test('OTP-002 - Incomplete code is rejected', async ({ page }) => {
    const verify = new VerifyPage(page);
    await verify.goto();
    await verify.typeCode('12345');
    await verify.verifyButton().click();
    await expect(verify.errors().filter({ hasText: 'Please enter the complete 6-digit code.' })).toBeVisible();
  });
});

test.describe('LexVerify — Login', () => {
  test('LGN-001 - Firm login page layout', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('firm');
    await expect(page.getByRole('heading', { name: 'Secure Login' })).toBeVisible();
    await expect(login.subtitle("Access your firm's encrypted workspace.")).toBeVisible();
    await expect(login.email()).toHaveAttribute('placeholder', 'attorney@firm.com');
    await expect(page.getByText('Remember this device')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
    await expect(login.registerFirmLink()).toHaveAttribute('href', '/register');
  });

  test('LGN-002 - Client login page layout', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('client');
    await expect(login.subtitle('Access your personal immigration workspace.')).toBeVisible();
    await expect(login.email()).toHaveAttribute('placeholder', 'your@email.com');
    await expect(login.registerFirmLink()).toHaveCount(0);
  });

  test('LGN-003 - Empty fields are rejected', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('firm');
    await login.submit().click();
    await expect(login.errors().filter({ hasText: 'Please fill in all fields.' })).toBeVisible();
  });

  test('LGN-004 - Email only or password only is rejected', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('firm');
    await login.email().fill('qa.only.email@example.com');
    await login.submit().click();
    await expect(login.errors().filter({ hasText: 'Please fill in all fields.' })).toBeVisible();

    await login.email().fill('');
    await login.password().fill('Some@12345');
    await login.submit().click();
    await expect(login.errors().filter({ hasText: 'Please fill in all fields.' })).toBeVisible();
  });

  test('LGN-005 - Wrong credentials keep the user signed out', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('firm');
    await login.login(`qa.nonexistent.${Date.now()}@example.com`, 'Wrong@12345');
    await expect(login.errors().first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);
    const stored = await page.evaluate(() => localStorage.getItem('lexverify_auth'));
    expect(stored ?? '').not.toMatch(/"accessToken":"[^"]+"/);
  });
});

test.describe('LexVerify — Forgot password', () => {
  test('FPW-001 - Forgot password page layout', async ({ page }) => {
    const fp = new ForgotPasswordPage(page);
    await fp.goto();
    await expect(fp.email()).toBeVisible();
    await expect(fp.sendCode()).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to login/ })).toBeVisible();
  });

  test('FPW-002 - Empty email is rejected', async ({ page }) => {
    const fp = new ForgotPasswordPage(page);
    await fp.goto();
    await fp.sendCode().click();
    await expect(fp.errors().filter({ hasText: 'Please enter your email address.' })).toBeVisible();
  });

  test('FPW-003 - Invalid email is rejected', async ({ page }) => {
    const fp = new ForgotPasswordPage(page);
    await fp.goto();
    await fp.email().fill('abc@');
    await fp.sendCode().click();
    await expect(fp.errors().filter({ hasText: 'Enter a valid email address.' })).toBeVisible();
  });
});

// /cases/new fails this on purpose-built grounds (2026-09-28): unlike the
// other pages it renders the create-case form to a signed-out user. That is
// a real missing route guard in the app — report it, don't relax the test.
test.describe('LexVerify — Route guards', () => {
  for (const path of ['/dashboard', '/cases', '/cases/new', '/tasks', '/team-member']) {
    test(`SES-001 - Signed-out access to ${path} redirects to login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Secure Login' })).toBeVisible();
    });
  }
});

test.describe('LexVerify — Invitation accept (invalid links)', () => {
  test('INV-001 - Accept page without a token', async ({ page }) => {
    await new InviteAcceptPage(page).goto();
    await expect(page.getByText('No invitation token provided')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept Invitation' })).toHaveCount(0);
  });

  test('INV-002 - Invalid token is refused', async ({ page }) => {
    await new InviteAcceptPage(page).goto('invalid-token-qa-123');
    await expect(page.getByText(/invalid|expired|no longer valid|not found/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Accept Invitation' })).toHaveCount(0);
  });
});

test.describe('LexVerify — Security', () => {
  // Intentionally strict: these assert what a production-grade pilot should
  // do. A failure here is a real finding to report, not a flaky test — do
  // not "fix" the assertion to match the current behaviour.
  test('SEC-001 - App is served over HTTPS', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).protocol, 'login credentials would travel in clear text').toBe('https:');
  });

  test('SEC-002 - Protected API rejects requests without a token', async () => {
    const api = await request.newContext({ baseURL: config.attorneyApiBaseUrl });
    const res = await api.get('/api/v1/cases');
    expect(res.status()).toBe(401);
    await api.dispose();
  });

  test('SEC-008 - Interactive API docs are not publicly exposed', async () => {
    const api = await request.newContext({ baseURL: config.attorneyApiBaseUrl });
    const res = await api.get('/docs');
    expect(res.status(), 'Swagger UI on the pilot lists every endpoint to anyone').not.toBe(200);
    await api.dispose();
  });
});
