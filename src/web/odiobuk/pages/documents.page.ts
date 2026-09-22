import { expect, Page, Locator } from '@playwright/test';

export class DocumentsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly fileInput: Locator;
  readonly cleanupSelect: Locator;
  readonly uploadButton: Locator;
  readonly yourBooksHeading: Locator;
  readonly emptyMessage: Locator;
  readonly selectFromStartButton: Locator;
  readonly useInAudiobookButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: 'Books' });
    this.fileInput = page.locator('input[type="file"]');
    this.cleanupSelect = page.locator('select').first();
    this.uploadButton = page.getByRole('button', { name: /Upload & extract/i });
    this.yourBooksHeading = page.getByRole('heading', { level: 3, name: 'Your books' });
    this.emptyMessage = page.getByText('Nothing uploaded yet.');
    this.selectFromStartButton = page.getByRole('button', { name: 'Select from start (within limit)' });
    this.useInAudiobookButton = page.getByRole('button', { name: /Use selection in .* Audiobooks/ });
  }

  async goto() {
    await this.page.goto('/documents', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.uploadButton).toBeVisible();
  }

  /** Uploads a PDF and waits for the extracted-text panel to open on the right. */
  async uploadAndOpen(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
    await this.uploadButton.click();
    await expect(this.selectFromStartButton).toBeVisible({ timeout: 30000 });
  }

  /** Selects all pages within the character limit and hands them off to Listen. */
  async sendSelectionToAudiobooks() {
    await this.selectFromStartButton.click();
    await this.useInAudiobookButton.click();
  }
}
