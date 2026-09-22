import { config } from '@config/env.config';
import { logger } from './logger';

/**
 * BaseMobileScreen
 * Every screen object in src/mobile/screens extends this. Mirrors
 * BaseWebPage's API (click/type/isVisible) so an engineer moving
 * between web and mobile suites doesn't have to learn two idioms.
 * `driver` is the WebdriverIO/Appium session injected by wdio.conf.ts.
 */
export abstract class BaseMobileScreen {
  get driver() {
    // WebdriverIO exposes a global `browser` in test context.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (global as any).browser;
  }

  async click(selector: string) {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: config.timeouts.default });
    await el.click();
  }

  async type(selector: string, text: string) {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: config.timeouts.default });
    // Flutter's text-input plugin only wires up once the field is
    // actually focused via a real tap; calling setValue() without one
    // first silently no-ops (the field stays empty) — found by comparing
    // an ADB-only manual run (which taps before typing) against a raw
    // Appium setValue() run against the same screen.
    await el.click();
    await el.setValue(text);
  }

  async textOf(selector: string): Promise<string> {
    const el = await this.driver.$(selector);
    return el.getText();
  }

  async isVisible(selector: string): Promise<boolean> {
    const el = await this.driver.$(selector);
    return el.isDisplayed().catch(() => false);
  }

  // isVisible() checks the current frame instantly; after a navigation
  // the destination screen can take a moment to render (transition
  // animation, first data fetch), so a same-instant check can read false
  // even though the screen arrives a few hundred ms later. Use this
  // instead whenever the check follows a tap that navigates.
  async waitVisible(selector: string, timeout = config.timeouts.default): Promise<boolean> {
    const el = await this.driver.$(selector);
    return el.waitForDisplayed({ timeout }).catch(() => false);
  }

  // Some full-width list rows (e.g. the PDF card on Home) report
  // accessibility bounds spanning the whole row, but the actual Flutter
  // gesture detector only covers the leading icon+text — the trailing
  // empty space is a dead zone. A plain click() taps the bounds' center,
  // which lands there and silently does nothing (no error, no
  // navigation). Confirmed by reproducing with a raw adb tap at the
  // reported center before concluding it wasn't an Appium-side bug.
  // Use this instead for any row that spans (most of) the screen width.
  async clickNearStart(selector: string, xOffsetPx = 60) {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: config.timeouts.default });
    const location = await el.getLocation();
    const size = await el.getSize();
    const x = location.x + Math.min(xOffsetPx, Math.max(size.width - 5, 1));
    const y = location.y + size.height / 2;
    await this.driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 80 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
  }

  async swipe(direction: 'up' | 'down') {
    logger.debug(`Swiping ${direction}`);
    const { width, height } = await this.driver.getWindowRect();
    const startY = direction === 'up' ? height * 0.8 : height * 0.2;
    const endY = direction === 'up' ? height * 0.2 : height * 0.8;
    await this.driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: width / 2, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 300, x: width / 2, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
  }
}
