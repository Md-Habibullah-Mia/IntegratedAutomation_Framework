import { expect, Page, Locator } from '@playwright/test';

export class LibraryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly booksCatalogueTab: Locator;
  readonly pdfsCatalogueTab: Locator;
  readonly myLibraryTab: Locator;
  readonly allFacetTab: Locator;
  readonly genreFacetTab: Locator;
  readonly authorFacetTab: Locator;
  readonly newFacetTab: Locator;
  readonly searchInput: Locator;
  readonly sortSelect: Locator;
  readonly orderSelect: Locator;
  readonly savedOnlyCheckbox: Locator;
  readonly resetButton: Locator;
  readonly uploadPdfLink: Locator;
  readonly emptyMessage: Locator;
  readonly paginationSummary: Locator;
  readonly rowTitles: Locator;
  readonly firstNarrateButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: 'Library' });
    this.booksCatalogueTab = page.getByRole('button', { name: 'Books Catalogue' });
    this.pdfsCatalogueTab = page.getByRole('button', { name: 'PDFs Catalogue' });
    this.myLibraryTab = page.getByRole('button', { name: 'My Library' });
    this.allFacetTab = page.getByRole('button', { name: 'All', exact: true });
    this.genreFacetTab = page.getByRole('button', { name: 'Genre', exact: true });
    this.authorFacetTab = page.getByRole('button', { name: 'Author', exact: true });
    this.newFacetTab = page.getByRole('button', { name: 'New', exact: true });
    this.searchInput = page.getByPlaceholder('Search title or author…');
    this.sortSelect = page.locator('select').nth(0);
    this.orderSelect = page.locator('select').nth(1);
    this.savedOnlyCheckbox = page.getByRole('checkbox', { name: 'Saved only' });
    this.resetButton = page.getByRole('button', { name: 'Reset' });
    this.uploadPdfLink = page.getByRole('link', { name: /Upload PDF \/ Book/ });
    this.emptyMessage = page.getByText(/No titles match|You have not generated/);
    // Scoped to "1–9 of 9" style paging text specifically — a plain /of \d+/
    // also matches the unrelated "Audiobooks (FREE): 0 of 15" quota line
    // elsewhere on the page (strict-mode violation otherwise).
    this.paginationSummary = page.getByText(/^\d[\d,]*[–-]\d[\d,]* of \d[\d,]*/);
    this.rowTitles = page.locator('.list-item strong');
    // "Narrate →" only shows on free/owned, not-yet-narrated titles — a paid,
    // unlocked title shows "Unlock →" instead, and an already-narrated one "▶ Play".
    this.firstNarrateButton = page.getByRole('button', { name: 'Narrate →' }).first();
  }

  async goto() {
    await this.page.goto('/library', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.booksCatalogueTab).toBeVisible();
  }

  row(title: string): Locator {
    return this.page.locator('.list-item').filter({ hasText: title });
  }

  async search(term: string) {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
  }

  async switchToMyLibrary() {
    await this.myLibraryTab.click();
  }

  async switchToPdfsCatalogue() {
    await this.pdfsCatalogueTab.click();
  }

  async toggleFavourite(title: string) {
    const row = this.row(title);
    await row.getByTitle(/Save|Remove from saved/).click();
  }

  async isFavourited(title: string): Promise<boolean> {
    const row = this.row(title);
    return (await row.getByTitle('Remove from saved').count()) > 0;
  }

  async open(title: string) {
    await this.row(title).getByRole('button', { name: /Narrate|Unlock|Play/ }).click();
  }
}
