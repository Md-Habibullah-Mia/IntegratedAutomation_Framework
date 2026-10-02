import { test, expect } from '@playwright/test';
import { LibraryPage } from '@web/odiobuk/pages/library.page';
import { SavedPage } from '@web/odiobuk/pages/saved.page';
import { closeSharedSession, openSharedSession } from '@utils/odiobuk-session';

// Uses the run's shared admin session — no sign-in of its own. Every test
// reads the shared catalogue; TC-006 favourites one title and un-saves it
// again so the shared account is left as it was.
test.describe.serial('Smoke - Library', () => {
  let context: import('@playwright/test').BrowserContext;
  let page: import('@playwright/test').Page;
  let libraryPage: LibraryPage;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await openSharedSession(browser));
    libraryPage = new LibraryPage(page);
  });

  test.afterAll(async () => {
    await closeSharedSession(context);
  });

  test('TC-004 - Library catalogue loads with browsable titles and tabs', async () => {
    await libraryPage.goto();
    await libraryPage.verifyLoaded();

    await expect(libraryPage.pdfsCatalogueTab).toBeVisible();
    await expect(libraryPage.myLibraryTab).toBeVisible();
    await expect(libraryPage.allFacetTab).toBeVisible();
    await expect(libraryPage.genreFacetTab).toBeVisible();
    await expect(libraryPage.authorFacetTab).toBeVisible();
    await expect(libraryPage.newFacetTab).toBeVisible();

    // The catalogue is admin-published content — assert the shape (at least one
    // browsable title with a paging summary), not specific titles.
    await expect(libraryPage.rowTitles.first()).toBeVisible();
    await expect(libraryPage.paginationSummary).toBeVisible();
  });

  test('TC-005 - Searching the catalogue filters to the matching title', async () => {
    await libraryPage.goto();
    await libraryPage.verifyLoaded();

    const firstTitle = (await libraryPage.rowTitles.first().textContent())?.trim();
    expect(firstTitle).toBeTruthy();

    await libraryPage.search(firstTitle as string);

    await expect(libraryPage.row(firstTitle as string)).toBeVisible();
  });

  test('TC-006 - Saving a catalogue title surfaces it under Saved > Books', async () => {
    await libraryPage.goto();
    await libraryPage.verifyLoaded();

    // A title the shared account hasn't saved yet, so the save is real.
    const unsaved = page.locator('.list-item').filter({ has: page.getByTitle('Save', { exact: true }) }).first();
    await expect(unsaved).toBeVisible();
    const target = (await unsaved.locator('strong').first().textContent())?.trim() as string;
    expect(target).toBeTruthy();

    await libraryPage.toggleFavourite(target);
    await expect(libraryPage.row(target).getByTitle('Remove from saved')).toBeVisible();

    const savedPage = new SavedPage(page);
    try {
      await savedPage.goto();
      await savedPage.verifyLoaded();
      await expect(savedPage.row(target)).toBeVisible();
    } finally {
      // Put the shared account back as it was.
      await savedPage.unsave(target).catch(() => {});
    }
  });
});
