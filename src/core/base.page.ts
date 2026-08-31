import { Page, Locator, expect } from '@playwright/test';
import { config } from '@config/env.config';
import { logger } from './logger';

/**
 * BaseWebPage
 * Every page object in src/web/pages extends this. Keeps common,
 * resilient interactions (click, type, wait) in one place so that
 * flaky-selector fixes or retry logic only need to change once.
 */
export abstract class BaseWebPage {
  constructor(protected page: Page) {}

  async goto(path = '') {
    const url = `${config.webBaseUrl}${path}`;
    logger.info(`Navigating to ${url}`);
    await this.page.goto(url, { timeout: config.timeouts.navigation });
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  async click(selector: string) {
    const el = this.locator(selector);
    await el.waitFor({ state: 'visible', timeout: config.timeouts.default });
    await el.click();
  }

  async type(selector: string, text: string, opts: { clear?: boolean } = { clear: true }) {
    const el = this.locator(selector);
    await el.waitFor({ state: 'visible', timeout: config.timeouts.default });
    if (opts.clear) await el.fill('');
    await el.fill(text);
  }

  async textOf(selector: string): Promise<string> {
    return (await this.locator(selector).innerText()).trim();
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.locator(selector).isVisible();
  }

  async expectVisible(selector: string) {
    await expect(this.locator(selector)).toBeVisible({ timeout: config.timeouts.default });
  }

  async waitForUrlContains(fragment: string) {
    await this.page.waitForURL(`**${fragment}**`, { timeout: config.timeouts.navigation });
  }

  async screenshot(name: string) {
    await this.page.screenshot({ path: `reports/screenshots/${name}.png`, fullPage: true });
  }
}
