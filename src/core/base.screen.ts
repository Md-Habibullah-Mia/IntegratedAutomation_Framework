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
