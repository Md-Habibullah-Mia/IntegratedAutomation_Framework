import { BaseMobileScreen } from '@core/base.screen';

// The app (MemoryWave — Odiobuk's Flutter mobile client, package
// com.ad.audio_book) only shows this sequence once per fresh install:
// splash -> "three things we keep" highlights -> entry-point choice ->
// privacy charter -> auth screen. Appium resets app data by default
// (noReset unset in wdio.conf.ts), so every test session starts here.
// Each step waits briefly for its own screen and is skipped if it never
// shows, so this is safe to call even if a session somehow starts later
// in the flow (e.g. noReset gets enabled in the future).
const SELECTORS = {
  splash: '//*[contains(@content-desc,"TAP ANYWHERE TO BEGIN")]',
  highlightsContinue: '~Continue',
  exploreAudiobooksEntry: '//*[contains(@content-desc,"I want to explore audiobooks")]',
  privacyAccept: "~I understand — let's begin",
};

export class OnboardingScreen extends BaseMobileScreen {
  private async tapIfPresent(selector: string, timeout = 4000): Promise<boolean> {
    const el = await this.driver.$(selector);
    const shown = await el.waitForDisplayed({ timeout }).catch(() => false);
    if (shown) {
      await el.click();
    }
    return shown;
  }

  async completeIfShown() {
    await this.tapIfPresent(SELECTORS.splash);
    await this.tapIfPresent(SELECTORS.highlightsContinue);
    await this.tapIfPresent(SELECTORS.exploreAudiobooksEntry);
    await this.tapIfPresent(SELECTORS.privacyAccept);
  }
}
