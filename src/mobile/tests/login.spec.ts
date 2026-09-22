import { expect } from 'chai';
import { config } from '@config/env.config';
import { OnboardingScreen } from '@mobile/screens/onboarding.screen';
import { LoginScreen } from '@mobile/screens/login.screen';
import { testUsers } from '@utils/data-provider';

describe('Mobile Login (MemoryWave / Odiobuk Android app)', () => {
  const onboarding = new OnboardingScreen();
  const screen = new LoginScreen();
  const { email: testEmail, password: testPassword } = config.mobile.testAccount;

  beforeEach(async () => {
    await onboarding.completeIfShown();
  });

  it('shows an error with invalid credentials', async () => {
    await screen.login(testUsers.invalid.email, testUsers.invalid.password);
    const error = await screen.getErrorMessage();
    expect(error).to.include('Invalid');
  });

  // Edge cases below verified live via manual exploration (adb) before
  // being encoded here, same as every other selector in this suite.
  // All are inline field validation, not the submit-flow error banner
  // `getErrorMessage()` targets — so checked directly via isVisible().

  it('shows an error when email is left empty', async () => {
    await screen.login(testUsers.edgeCases.emptyEmail.email, testUsers.edgeCases.emptyEmail.password);
    const shown = await screen.isVisible('~Email is required');
    expect(shown).to.equal(true);
  });

  it('shows an error when password is left empty', async () => {
    await screen.login(testUsers.edgeCases.emptyPassword.email, testUsers.edgeCases.emptyPassword.password);
    const shown = await screen.isVisible('~Password is required');
    expect(shown).to.equal(true);
  });

  it('rejects a malformed email with client-side validation', async () => {
    await screen.login(testUsers.edgeCases.malformedEmail.email, testUsers.edgeCases.malformedEmail.password);
    const shown = await screen.isVisible('~Enter a valid email');
    expect(shown).to.equal(true);
  });

  // The injection string isn't email-shaped, so this never reaches the
  // backend at all — the same client-side format check as the malformed-
  // email case above catches it first. Real proof of injection safety
  // would need to target a field that *does* reach the server (e.g. via
  // the API suite), but it's still worth confirming the client doesn't
  // do anything unsafe with the raw string (crash, pass it through
  // unescaped to a WebView, etc.) — it doesn't; it's just rejected.
  it('rejects a SQL-injection-shaped email with the same client-side validation', async () => {
    await screen.login(
      testUsers.edgeCases.sqlInjectionAttempt.email,
      testUsers.edgeCases.sqlInjectionAttempt.password
    );
    const shown = await screen.isVisible('~Enter a valid email');
    expect(shown).to.equal(true);
  });

  // Skipped until MOBILE_TEST_EMAIL / MOBILE_TEST_PASSWORD are set in
  // .env.dev.local — see that file for where to put them.
  //
  // Verified live: this account's credentials are accepted (a real
  // "Login successful." toast fires), but every account — not just a
  // fresh one — is routed through "First-Login Verification" (a live
  // face + voice liveness check: continuous speech plus head-turn
  // prompts) before reaching the actual app. That screen is the real,
  // honest boundary of what auth alone proves; it isn't a form and isn't
  // modeled here — see the CHANGELOG/QA_WORK_LOG for the open question
  // of whether/how to get a test account past it.
  (testEmail && testPassword ? it : it.skip)(
    'logs in successfully with valid credentials',
    async () => {
      await screen.login(testEmail as string, testPassword as string);
      const reachedVerification = await browser
        .$('~First-Login Verification')
        .waitForDisplayed({ timeout: 15000 })
        .catch(() => false);
      expect(reachedVerification).to.equal(true);
    }
  );
});
