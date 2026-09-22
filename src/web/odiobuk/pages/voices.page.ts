import { expect, Page, Locator } from '@playwright/test';

export class VoicesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly voiceHubTab: Locator;
  readonly myVoicesTab: Locator;
  readonly lentByOthersTab: Locator;
  readonly sessionSelect: Locator;
  readonly voiceNameInput: Locator;
  readonly traitInputs: Locator;
  readonly registerButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: /^Voices/ });
    this.voiceHubTab = page.getByRole('button', { name: 'Voice hub' });
    this.myVoicesTab = page.getByRole('button', { name: 'My voices' });
    this.lentByOthersTab = page.getByRole('button', { name: 'Lent by others' });
    this.sessionSelect = page.locator('select').first();
    this.voiceNameInput = page.getByPlaceholder('Grandma Rose');
    this.traitInputs = page.getByPlaceholder(/Deep|Warm|Considered/);
    this.registerButton = page.getByRole('button', { name: 'Register voice' });
    this.searchInput = page.getByPlaceholder('Search voices…');
  }

  async goto() {
    await this.page.goto('/voices', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.voiceHubTab).toBeVisible();
  }

  row(name: string): Locator {
    return this.page.locator('.list-item').filter({ hasText: name });
  }
}
