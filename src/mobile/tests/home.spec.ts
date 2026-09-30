import { expect } from 'chai';
import { HomeScreen } from '@mobile/screens/home.screen';
import { PlayerScreen } from '@mobile/screens/player.screen';
import { BookPagesScreen } from '@mobile/screens/book-pages.screen';

// Assumes the app is already logged in AND has already passed First-Login
// Verification on this device (wdio.conf.ts runs with noReset:true for
// exactly this reason — see that file's comment). This suite never
// touches login, registration, or verification.
describe('Home (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const player = new PlayerScreen();
  const bookPages = new BookPagesScreen();

  // The account's own audiobook, narrated from the store title (verified
  // live 2026-09-30: Home → YOUR AUDIOBOOKS · ALL 1).
  const AUDIOBOOK_TITLE = 'And Then There Were None';
  // HOM-013 stays skipped: the account has no PDF of its own and the
  // backend no longer accepts one (POST /api/documents → 403 "Uploading
  // your own book is no longer available…", rechecked 2026-09-30), so
  // Home's PDF section only shows the app's built-in examples. Placeholder
  // name kept for if own-PDF upload ever returns.
  const PDF_FILENAME = 'qa-fixture-book';

  // With noReset:true, Appium attaches to whatever screen the app was
  // last left on (it does not relaunch to a known state), so a prior
  // test's leftover position (e.g. stuck on Player after an assertion
  // failure) would otherwise cascade into every later test in this file.
  // ensureDisplayed() presses back at most twice (the bottom-nav tabs
  // are at the root of the stack — one back press too many exits the
  // app to the launcher instead of stopping at Home) and relaunches the
  // app as a fallback, which correctly re-resolves session/verification
  // state since both persist locally.
  beforeEach(async () => {
    await home.ensureDisplayed();
  });

  it('HOM-003: shows a time-based greeting with the account name', async () => {
    const displayed = await home.isDisplayed();
    expect(displayed).to.equal(true);
    const greeting = await home.getGreetingText();
    expect(greeting).to.match(/^(Good morning|Good afternoon|Good evening|Welcome), \S+/);
  });

  it('HOM-011a: lists the account\'s real audiobooks under Your Audiobooks', async () => {
    const sectionVisible = await home.isAudiobooksSectionVisible();
    expect(sectionVisible).to.equal(true);
    const tileVisible = await home.isVisible(home.audiobookTile(AUDIOBOOK_TITLE));
    expect(tileVisible).to.equal(true);
  });

  it('HOM-011b / AUD-034: tapping a playable audiobook opens the player with the correct title', async () => {
    await home.openAudiobook(AUDIOBOOK_TITLE);
    const onPlayer = await player.isDisplayed();
    expect(onPlayer).to.equal(true);
    const correctTitle = await player.isTitleVisible(AUDIOBOOK_TITLE);
    expect(correctTitle).to.equal(true);
    const chapterShown = await player.isChapterPillVisible();
    expect(chapterShown).to.equal(true);
    // Return to Home for the next test — Android back closes the player
    // without stopping playback (see AUD-063), same as a real user.
    await browser.back();
  });

  it.skip('HOM-013a: lists the account\'s real PDF under Your Books · PDF', async () => {
    const sectionVisible = await home.isPdfSectionVisible();
    expect(sectionVisible).to.equal(true);
    const tileVisible = await home.isVisible(home.pdfTile(PDF_FILENAME));
    expect(tileVisible).to.equal(true);
  });

  it.skip('HOM-013b / LIB-023 / LIB-024: tapping the PDF opens Book Pages with the right filename and page list', async () => {
    await home.openPdf(PDF_FILENAME);
    const onBookPages = await bookPages.isDisplayed();
    expect(onBookPages).to.equal(true);
    const filenameShown = await bookPages.isFilenameVisible(`${PDF_FILENAME}.pdf`);
    expect(filenameShown).to.equal(true);
    const firstPageShown = await bookPages.isVisible(bookPages.pageRow('Page 1 ·'));
    expect(firstPageShown).to.equal(true);
    await bookPages.goBack();
  });

  it('HOM-016: bottom navigation switches tabs and each shows its own real header', async () => {
    const onHomeAgain = await home.isDisplayed();
    expect(onHomeAgain).to.equal(true);

    await home.openToday();
    const todayGreeting = await browser.$('//*[starts-with(@content-desc,"Today,")]').isDisplayed();
    expect(todayGreeting).to.equal(true);

    await home.openLibrary();
    const libraryHeader = await browser.$('~Library').isDisplayed();
    expect(libraryHeader).to.equal(true);

    await home.openVoices();
    const voicesHeader = await browser.$('~Voices').isDisplayed();
    expect(voicesHeader).to.equal(true);

    await home.openHome();
    const backOnHome = await home.isDisplayed();
    expect(backOnHome).to.equal(true);
  });
});
