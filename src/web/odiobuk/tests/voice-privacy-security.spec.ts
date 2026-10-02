import { test, expect } from '@playwright/test';
import { config } from '@config/env.config';
import { LoginPage } from '@web/odiobuk/pages/login.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { VoicesPage } from '@web/odiobuk/pages/voices.page';

// GitHub issue #13, finding 1: Restful-App/backend/app/api/media.py:59-64
// authorizes a voice preview clip purely on `status == "ready"`, ignoring
// visibility/entitlement entirely. Anyone signed in — not just the owner, an
// entitled holder, or (for a shared persona) one of its lend recipients —
// can fetch the clip if they know the persona's UUID.
//
// This test proves it live against the real deployed backend, using only the
// two pre-provisioned accounts already in env (.env.dev.local) — no new
// account is registered. It reads the real test account's existing
// "Riad New" persona id (no new voice created either — the web UI disables
// registration for non-admin accounts anyway, confirmed by voices.spec.ts
// TC-009), then fetches that persona's preview media as the separate admin
// account, which has no ownership/entitlement relationship to this persona.
// The issue's own suggested fix (owner / system / public / holds_grant)
// carves out no admin exception for the voices root, so the admin account
// should be refused exactly like any other unrelated signed-in user.
//
// Expected once media.py is fixed: 403. As of 2026-09-11 (source still
// unpatched — see the issue): 200, proving the bypass.
test.describe('Security - Voice preview authorization (issue #13, finding 1)', () => {
  test('SEC-001 - An unrelated account should not be able to fetch another user\'s voice preview by guessing its id', async ({
    page,
    request,
  }) => {
    const ownerEmail = config.mobile.testAccount.email;
    const ownerPassword = config.mobile.testAccount.password;
    test.skip(!ownerEmail || !ownerPassword, 'MOBILE_TEST_EMAIL/PASSWORD not configured');
    // The test account's ready voice (since the 2026-09-24 backend reset the
    // old "Riad New" is gone; "HH2" verified ready 2026-09-30).
    const TARGET_VOICE = 'HH2';

    // 1. Log in as the real account that owns the voice and read its persona
    // id straight off the rendered <audio src>  — no new voice created.
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    const voicesPage = new VoicesPage(page);

    await loginPage.goto();
    await loginPage.login(ownerEmail!, ownerPassword!);
    await homePage.verifyLoaded();

    await voicesPage.goto();
    await voicesPage.verifyLoaded();
    await voicesPage.myVoicesTab.click();

    const voiceRow = voicesPage.row(TARGET_VOICE);
    await expect(voiceRow).toBeVisible({ timeout: 15000 });
    const audioSrc = await voiceRow.locator('audio').getAttribute('src');
    expect(audioSrc, `expected an <audio src> on the ${TARGET_VOICE} row`).not.toBeNull();

    const idMatch = audioSrc!.match(/\/media\/voices\/([0-9a-f-]{36})\//i);
    expect(idMatch, `could not extract a persona id from ${audioSrc}`).not.toBeNull();
    const personaId = idMatch![1];
    console.log('Target persona id (owned by the real test account):', personaId);

    // 2. A brand-new, unrelated account — it owns nothing and holds no lend
    // grant on this persona. (Was the pre-provisioned admin until its login
    // stopped working on 2026-10-02; a fresh account is the cleaner proof.)
    const otherContext = await page.context().browser()!.newContext({ baseURL: config.odiobukWebBaseUrl });
    const otherPage = await otherContext.newPage();
    const otherHome = new HomePage(otherPage);

    let otherAccessToken: string | undefined;
    otherPage.on('response', async (res) => {
      if (/\/api\/auth\/(login|register)$/.test(res.url()) && res.request().method() === 'POST') {
        const body = await res.json().catch(() => null);
        otherAccessToken = body?.tokens?.access_token ?? otherAccessToken;
      }
    });

    const registrationPage = new RegistrationPage(otherPage);
    await registrationPage.goto();
    await registrationPage.register('QA Unrelated', `qa_sec001_${Date.now()}@test.com`, 'Str0ngP@ssword2026!');
    await otherHome.verifyLoaded();
    expect(otherAccessToken, 'expected an access_token in the sign-up response').toBeTruthy();

    // 3. The unrelated account fetches the owner's persona preview directly.
    const mediaUrl = `${config.odiobukWebBaseUrl}/api/media/voices/${personaId}/preview.mp3`;
    const res = await request.get(mediaUrl, {
      headers: { Authorization: `Bearer ${otherAccessToken}` },
    });
    console.log(`Unrelated account fetched ${mediaUrl} -> HTTP ${res.status()}`);

    // This is the assertion for CORRECT behavior. It failed when reported
    // (the live response was 200, not 403) — that failure IS the reproduction.
    expect(res.status(), 'an unrelated account should be refused access to a private/unentitled voice preview').toBe(403);

    await otherContext.close();
  });
});
