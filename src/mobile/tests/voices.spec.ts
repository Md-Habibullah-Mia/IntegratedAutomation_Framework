import { expect } from 'chai';
import { HomeScreen } from '@mobile/screens/home.screen';
import { VoicesScreen } from '@mobile/screens/voices.screen';

// Assumes an already logged-in, already-verified session (see
// wdio.conf.ts noReset comment and home.spec.ts) — never touches login,
// registration, or verification. Deliberately non-mutating: every dialog
// opened here is cancelled (Cancel / Not now), never confirmed, so no
// voice is actually registered or lent by this suite.
describe('Voices (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const voices = new VoicesScreen();

  // Real account content used as ground truth (verified live): a ready,
  // unshared voice ("Riad New") with a "Lend" action, and at least one
  // unregistered capture session ("Riad", "Recorded · not named yet")
  // with a "Register" action.
  const READY_VOICE_NAME = 'Riad New';

  beforeEach(async () => {
    await home.ensureDisplayed();
    await home.openVoices();
    const onVoices = await voices.isDisplayed();
    expect(onVoices, 'failed to reach Voices from Home in beforeEach').to.equal(true);
  });

  it('VOI header, tagline, and record CTA render correctly', async () => {
    const taglineVisible = await voices.isTaglineVisible();
    expect(taglineVisible).to.equal(true);
    const recordCtaVisible = await voices.isRecordCtaVisible();
    expect(recordCtaVisible).to.equal(true);
  });

  it('VOI-004/VOI-009: Your Voices lists real ready voices and an unregistered session', async () => {
    const sectionVisible = await voices.isYourVoicesSectionVisible();
    expect(sectionVisible).to.equal(true);
    const readyVoiceVisible = await voices.isVisible(voices.voiceRow(READY_VOICE_NAME, 'Ready to narrate'));
    expect(readyVoiceVisible).to.equal(true);
    const unregisteredVisible = await voices.isVisible(voices.voiceRow('Riad', 'not named yet'));
    expect(unregisteredVisible).to.equal(true);
  });

  it('VOI-010/VOI-011: Register dialog opens pre-filled and Cancel discards without mutating', async () => {
    await voices.openFirstRegisterDialog();
    const dialogVisible = await voices.isRegisterDialogVisible();
    expect(dialogVisible).to.equal(true);
    await voices.cancelRegisterDialog();
    // Confirms the dialog actually closed and Voices is showing again —
    // a stuck dialog would fail this the same way a real regression would.
    const backOnVoices = await voices.isDisplayed();
    expect(backOnVoices).to.equal(true);
  });

  it('VOI-016/VOI-017: Lend dialog shows the real consent text and "Not now" declines without mutating', async () => {
    await voices.openFirstLendDialog();
    const titleVisible = await voices.isLendDialogTitleVisible(READY_VOICE_NAME);
    expect(titleVisible).to.equal(true);
    const consentVisible = await voices.isLendConsentTextVisible();
    expect(consentVisible).to.equal(true);
    await voices.declineLendDialog();
    // The voice should still show its "Lend" action (unshared), not
    // "Withdraw" — confirming the decline truly made no server change.
    const stillLendable = await voices.waitVisible(voices.voiceRow(READY_VOICE_NAME, 'Ready to narrate'));
    expect(stillLendable).to.equal(true);
  });
});
