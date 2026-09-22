import { expect, Page, Locator } from '@playwright/test';

/**
 * Admin · PDF Catalogue (`/admin/pdfs`). This is where PDFs actually get
 * uploaded on this deployment — not a personal per-user upload page. Upload
 * publishes a shared catalogue title (title/author/genre/price) that starts
 * as a draft; a separate "Publish" click makes it live, and "Narrate"
 * generates the one shared house-voice narration every listener hears.
 */
export class AdminPdfsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly pdfFileInput: Locator;
  readonly titleInput: Locator;
  readonly authorInput: Locator;
  readonly genreInput: Locator;
  readonly uploadAsDraftButton: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly allTitlesHeading: Locator;
  readonly houseVoiceSelect: Locator;
  readonly generateNarrationButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: /Admin . PDF Catalogue/ });
    this.pdfFileInput = page.getByRole('button', { name: 'PDF file', exact: true });
    this.titleInput = page.getByRole('textbox', { name: 'Title', exact: true });
    this.authorInput = page.getByRole('textbox', { name: 'Author', exact: true });
    this.genreInput = page.getByRole('textbox', { name: 'Genre', exact: true });
    this.uploadAsDraftButton = page.getByRole('button', { name: 'Upload as draft' });
    this.searchInput = page.getByRole('textbox', { name: 'Search title or author…' });
    this.searchButton = page.getByRole('button', { name: 'Search', exact: true });
    this.allTitlesHeading = page.getByRole('heading', { level: 3, name: /All titles/ });
    this.houseVoiceSelect = page.getByRole('combobox', { name: 'House voice' });
    this.generateNarrationButton = page.getByRole('button', { name: 'Generate narration' });
  }

  async goto() {
    await this.page.goto('/admin/pdfs', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.uploadAsDraftButton).toBeVisible();
  }

  /** Uploads a PDF as a new draft catalogue title and waits for the confirmation. */
  async uploadAsDraft(filePath: string, title: string, author: string, genre: string) {
    await this.pdfFileInput.setInputFiles(filePath);
    await this.titleInput.fill(title);
    await this.authorInput.fill(author);
    await this.genreInput.fill(genre);
    await this.uploadAsDraftButton.click();
    await expect(this.row(title)).toBeVisible({ timeout: 30000 });
  }

  /** The catalogue list row for a title — scopes badges/buttons to just that title. */
  row(title: string): Locator {
    return this.page.locator('div.list-item').filter({ hasText: title });
  }

  async searchFor(title: string) {
    await this.searchInput.fill(title);
    await this.searchButton.click();
  }

  async publish(title: string) {
    await this.row(title).getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(this.row(title).getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
  }

  /**
   * Opens the inline narration panel for a draft/live title. The house-voice
   * dropdown's default selection loads asynchronously just after the panel
   * itself appears, so this waits for it to actually hold a value rather
   * than just for the panel to be visible.
   */
  async openNarrationPanel(title: string) {
    await this.row(title).getByRole('button', { name: 'Narrate', exact: true }).click();
    await expect(this.generateNarrationButton).toBeVisible();
    await expect(async () => {
      expect(await this.houseVoiceSelect.inputValue()).not.toBe('');
    }).toPass({ timeout: 10000 });
  }

  async generateNarration() {
    await this.generateNarrationButton.click();
  }

  /**
   * Polls the catalogue (reloading, since generation status doesn't
   * push-update the list) until the title's row shows it has been narrated
   * — its action button flips from "Narrate" to "Narration".
   *
   * This is a live, shared dev backend — other testers' real activity shows
   * up in the job queue alongside ours — so a just-touched title is NOT
   * reliably on page one of the default 10-per-page "last edited" sort by
   * the time we reload minutes later; someone else's concurrent edit can
   * push it off. Setting "Per page" to All sidesteps that. (The search box
   * was tried first and dropped: it intermittently returned "No titles
   * match those filters" for a title that demonstrably existed — a
   * backend indexing-lag bug worth its own report, not something to build
   * a wait around.)
   */
  async waitForNarrationToFinish(title: string, timeout: number) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await this.goto();
      await this.page.getByRole('combobox', { name: 'Per page' }).selectOption('All');
      const narrated = await this.row(title)
        .getByRole('button', { name: 'Narration', exact: true })
        .isVisible()
        .catch(() => false);
      if (narrated) return;
      await this.page.waitForTimeout(8000);
    }
    throw new Error(`Narration for "${title}" did not finish within ${timeout}ms`);
  }

  /** Removes a catalogue title (the "✕" row action) — used to clean up test data. */
  async remove(title: string) {
    await this.page.getByRole('combobox', { name: 'Per page' }).selectOption('All');
    this.page.once('dialog', (d) => d.accept());
    await this.row(title).getByRole('button', { name: '✕', exact: true }).click();
    await expect(this.row(title)).not.toBeVisible();
  }
}
