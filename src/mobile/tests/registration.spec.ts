import { expect } from 'chai';
import { config } from '@config/env.config';
import { OnboardingScreen } from '@mobile/screens/onboarding.screen';
import { RegistrationScreen } from '@mobile/screens/registration.screen';

describe('Mobile Registration (MemoryWave / Odiobuk Android app)', () => {
  const onboarding = new OnboardingScreen();
  const screen = new RegistrationScreen();
  const { email: existingEmail } = config.mobile.testAccount;

  beforeEach(async () => {
    await onboarding.completeIfShown();
    await screen.open();
  });

  it('shows required-field errors when submitted empty', async () => {
    await screen.register('', '', '', '');
    expect(await screen.isNameRequiredErrorVisible()).to.equal(true);
    expect(await screen.isEmailRequiredErrorVisible()).to.equal(true);
  });

  it('rejects a password under 8 characters', async () => {
    await screen.register('Test User', 'new.throwaway@example.com', 'short', 'short');
    const shown = await screen.isPasswordTooShortErrorVisible();
    expect(shown).to.equal(true);
  });

  it('rejects mismatched password and confirmation', async () => {
    await screen.register('Test User', 'new.throwaway@example.com', 'ValidPass123', 'DifferentPass456');
    const shown = await screen.isPasswordMismatchErrorVisible();
    expect(shown).to.equal(true);
  });

  // Reuses the provisioned MOBILE_TEST_EMAIL account (real, known to
  // exist) rather than a throwaway address — proves duplicate-email
  // detection without needing a second real account. Skipped until that
  // env var is set, same convention as login.spec.ts's valid-login test.
  (existingEmail ? it : it.skip)('rejects an email that is already registered', async () => {
    await screen.register('Test User', existingEmail as string, 'ValidPass123', 'ValidPass123');
    const shown = await screen.isDuplicateEmailErrorVisible();
    expect(shown).to.equal(true);
  });

  // Deliberately not automated: a real successful registration creates a
  // real account in the production backend (no throwaway/sandbox mode
  // observed), and — same as login — would immediately hit the
  // First-Login Verification liveness gate (see login.spec.ts / CHANGELOG
  // Phase 12), so it couldn't be verified unattended anyway. Revisit once
  // there's a safe way to create and clean up test accounts.
});
