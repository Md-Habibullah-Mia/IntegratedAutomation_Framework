import { expect, Page, Locator } from '@playwright/test';

export class SavedPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly booksTab: Locator;
  readonly pdfsTab: Locator;
  readonly audiobooksTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: 'Saved' });
    this.booksTab = page.getByRole('button', { name: 'Books', exact: true });
    this.pdfsTab = page.getByRole('button', { name: 'PDFs', exact: true });
    this.audiobooksTab = page.getByRole('button', { name: 'Audiobooks', exact: true });
  }

  async goto() {
    await this.page.goto('/saved', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
  }

  row(title: string): Locator {
    return this.page.locator('.list-item').filter({ hasText: title });
  }

  emptyMessage(kind: 'book' | 'pdf' | 'audiobook'): Locator {
    const text = {
      book: 'No saved titles. Tap the heart on any Library row.',
      pdf: 'No saved PDFs.',
      audiobook: 'No saved audiobooks — save one from its player page.',
    }[kind];
    return this.page.getByText(text);
  }

  async unsave(title: string) {
    await this.row(title).getByTitle('Remove from saved').click();
  }
}
