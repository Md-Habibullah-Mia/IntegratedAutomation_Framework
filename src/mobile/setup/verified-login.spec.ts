import { expect } from 'chai';
import { config } from '@config/env.config';
import { OnboardingScreen } from '@mobile/screens/onboarding.screen';
import { LoginScreen } from '@mobile/screens/login.screen';
import { HomeScreen } from '@mobile/screens/home.screen';

// The single real login for the post-login suites (home/library/
// audiobooks/voices/profile/vault), which all assume an already-logged-in,
// already-verified app via wdio.conf.ts's noReset:true.
//
// Run AFTER src/utils/mobile-verified-seed.ts has seeded the local
// First-Login Verification flag — that's why a correct login here must
// land straight on Home (LGN-010) instead of the liveness screen. Kept
// outside src/mobile/tests/ so a plain `npm run test:mobile` never picks
// it up; CI invokes it explicitly with --spec.
describe('Mobile verified-session setup (MemoryWave / Odiobuk Android app)', () => {
  const onboarding = new OnboardingScreen();
  const login = new LoginScreen();
  const home = new HomeScreen();

  it('LGN-010: a pre-verified account logs in straight to Home, skipping verification', async () => {
    const { email, password } = config.mobile.testAccount;
    expect(email, 'MOBILE_TEST_EMAIL must be set').to.be.a('string');
    expect(password, 'MOBILE_TEST_PASSWORD must be set').to.be.a('string');

    // Already logged in (e.g. a persistent local emulator) — nothing to do.
    if (await home.isDisplayed()) return;

    await onboarding.completeIfShown();
    await login.login(email as string, password as string);

    const onHome = await home.waitDisplayed(20000);
    const onVerification = await browser.$('~First-Login Verification').isDisplayed().catch(() => false);
    expect(onVerification, 'landed on First-Login Verification — was the flag seeded for this user id?').to.equal(false);
    expect(onHome).to.equal(true);
  });
});
