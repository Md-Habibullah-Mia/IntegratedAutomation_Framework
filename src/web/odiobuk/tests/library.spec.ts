import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { LibraryPage } from '@web/odiobuk/pages/library.page';
import { SavedPage } from '@web/odiobuk/pages/saved.page';

const PASSWORD = 'Str0ngP@ssword2026!';

async function registerFreshAccount(page: import('@playwright/test').Page, label: string) {
  const email = `qa_${label}_${Date.now()}@test.com`;
  const registrationPage = new RegistrationPage(page);
  const homePage = new HomePage(page);
  await registrationPage.goto();
  await registrationPage.register(`QA ${label}`, email, PASSWORD);
  await homePage.verifyLoaded();
}

test.describe('Smoke - Library', () => {
  test('TC-004 - Library catalogue loads with browsable titles and tabs', async ({ page }) => {
    await registerFreshAccount(page, 'Library');

    const libraryPage = new LibraryPage(page);
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

  test('TC-005 - Searching the catalogue filters to the matching title', async ({ page }) => {
    await registerFreshAccount(page, 'Search');

    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    await libraryPage.verifyLoaded();

    const firstTitle = (await libraryPage.rowTitles.first().textContent())?.trim();
    expect(firstTitle).toBeTruthy();

    await libraryPage.search(firstTitle as string);

    await expect(libraryPage.row(firstTitle as string)).toBeVisible();
  });

  test('TC-006 - Saving a catalogue title surfaces it under Saved > Books', async ({ page }) => {
    await registerFreshAccount(page, 'Favourite');

    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    await libraryPage.verifyLoaded();

    const title = (await libraryPage.rowTitles.first().textContent())?.trim() as string;
    expect(title).toBeTruthy();

    await libraryPage.toggleFavourite(title);
    await expect(libraryPage.row(title).getByTitle('Remove from saved')).toBeVisible();

    const savedPage = new SavedPage(page);
    await savedPage.goto();
    await savedPage.verifyLoaded();

    await expect(savedPage.row(title)).toBeVisible();
  });
});
