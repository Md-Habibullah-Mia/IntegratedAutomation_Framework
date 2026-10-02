import { expect, Page, Locator } from '@playwright/test';

export class ListenPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly voiceSelect: Locator;
  readonly generateButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1').first();
    this.voiceSelect = page.getByRole('combobox', { name: 'Voice' });
    this.generateButton = page.getByRole('button', { name: /Generate my narration|Generating/ });
    this.errorMessage = page.locator('.error-box');
  }

  /**
   * A voice is auto-selected once the account's voices load. The select
   * renders first (briefly "No voices available") and GET /api/voices fills
   * it a moment later, so wait for a value rather than reading it at once
   * (read-at-once failed on 2026-10-02 although the list then had 2 voices).
   */
  async verifyHouseVoicePreselected() {
    await expect(this.voiceSelect).toBeVisible({ timeout: 30000 });
    await expect(this.voiceSelect).not.toHaveValue('', { timeout: 30000 });
  }

  async generate() {
    await this.generateButton.click();
  }

  /**
   * Waits for the generation job to finish and the app to redirect to the player.
   *
   * Races the redirect against the page's own error box: `narrate()` can fail
   * synchronously (the create-audiobook call itself rejecting) long before any job
   * exists to poll, and without this the test would otherwise burn the full
   * `timeout` waiting for a redirect that was never coming.
   */
  async waitForGenerationToFinish(timeout: number) {
    const redirected = this.page.waitForURL(/\/audiobooks\/[^/]+$/, { timeout });
    const failed = this.errorMessage.waitFor({ state: 'visible', timeout }).then(async () => {
      const text = (await this.errorMessage.textContent())?.trim();
      throw new Error(`Generation request failed before a job could start: ${text}`);
    });
    await Promise.race([redirected, failed]);
  }
}
