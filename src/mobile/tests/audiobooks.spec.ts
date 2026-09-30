import { expect } from 'chai';
import { HomeScreen } from '@mobile/screens/home.screen';
import { LibraryScreen } from '@mobile/screens/library.screen';
import { AudiobooksScreen } from '@mobile/screens/audiobooks.screen';
import { AudiobookPlayerScreen } from '@mobile/screens/audiobook-player.screen';

// Assumes an already logged-in, already-verified session — never
// touches login, registration, or verification. Uses only existing,
// already-registered voices (never records a new one, per instruction).
//
// This suite's generate test is a REAL mutation: it submits an actual
// narration job against the live backend using this account's paid
// entitlement (already purchased live before this suite was written —
// "Ten Minutes to Six", $4.49, via the same mock-payment path as the
// Profile Upgrade dialog: no real charge). Re-running it re-generates
// the same title again rather than failing, so it's safe to repeat, but
// it does add a new entry to the account's audiobook history each time.
// Re-enabled 2026-09-30: the store is stocked again, the account owns
// "And Then There Were None" (Public → Audiobook, "Yours"; its sheet shows
// "Narrate in your voice") and has a ready voice, "HH2".
describe('Audiobooks generation & playback (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const library = new LibraryScreen();
  const audiobooks = new AudiobooksScreen();
  const player = new AudiobookPlayerScreen();

  const CATALOGUE_TITLE = 'And Then There Were None';
  const EXISTING_VOICE = 'HH2';

  beforeEach(async () => {
    await home.ensureDisplayed();
    await home.openLibrary();
    const onLibrary = await library.isDisplayed();
    expect(onLibrary, 'failed to reach Library from Home in beforeEach').to.equal(true);
    await library.openPublicShelf();
    await library.selectCategory('Audiobook');
  });

  it('AUD-004/AUD-015: opening an owned catalogue title pre-fills an existing voice, title, and the store-source note', async () => {
    await library.openCatalogueAudiobook(CATALOGUE_TITLE);
    const narrateVisible = await library.isNarrateInYourVoiceVisible();
    expect(narrateVisible).to.equal(true);
    await library.tapNarrateInYourVoice();

    const onForm = await audiobooks.isDisplayed();
    expect(onForm).to.equal(true);
    const summary = await audiobooks.getFormSummaryText();
    expect(summary).to.include(CATALOGUE_TITLE);
    expect(summary).to.include('The full text is narrated from the store copy');
    await audiobooks.waitForVoicesLoaded();
    const voicePreselected = await audiobooks.isVoicePreselected(EXISTING_VOICE);
    expect(voicePreselected).to.equal(true);
  });

  it('AUD-021: Generate produces the real "Narration started" confirmation, using the existing voice', async () => {
    await library.openCatalogueAudiobook(CATALOGUE_TITLE);
    await library.tapNarrateInYourVoice();
    const onForm = await audiobooks.isDisplayed();
    expect(onForm, 'failed to reach the generation form').to.equal(true);

    await audiobooks.waitForVoicesLoaded();
    // One narration at a time: an earlier run's job must finish first.
    const idle = await audiobooks.waitUntilNoNarrationRunning();
    expect(idle, 'an earlier narration is still QUEUED/RUNNING — the app blocks a new one until it finishes').to.equal(true);
    const previousNewest = (await audiobooks.historyRows())[0];
    await audiobooks.tapGenerate();
    const dialogVisible = await audiobooks.isSuccessDialogVisible();
    expect(dialogVisible).to.equal(true);
    await audiobooks.dismissSuccessDialog();

    // Short store titles finish in minutes here, despite the dialog's
    // "10–15 minutes" copy — so a NEW row reaching DONE is a real thing to
    // wait for, not just "queued".
    const done = await audiobooks.isTaskDone(CATALOGUE_TITLE, previousNewest?.meta, 8 * 60000);
    expect(done, `a new "${CATALOGUE_TITLE}" row (newest before: ${previousNewest?.meta ?? 'none'}) should reach DONE`).to.equal(true);
    // Set on the test object: wdio applies the timeout before the body
    // runs, so this.timeout() inside it is too late. Real generation took
    // 1–5 min on 2026-09-29/30, plus up to 3 min for an earlier job.
  }).timeout(14 * 60000);

  it('AUD-034/AUD-036: opening a finished audiobook from the history list opens its player with the right title', async () => {
    await library.openCatalogueAudiobook(CATALOGUE_TITLE);
    await library.tapNarrateInYourVoice();
    const onForm = await audiobooks.isDisplayed();
    expect(onForm, 'failed to reach the generation form').to.equal(true);

    await audiobooks.openTask(CATALOGUE_TITLE);
    const titleVisible = await player.isTitleVisible(CATALOGUE_TITLE);
    expect(titleVisible).to.equal(true);
    const chapterVisible = await player.isFirstChapterButtonVisible();
    expect(chapterVisible).to.equal(true);
    const seekBarVisible = await player.isSeekBarVisible();
    expect(seekBarVisible).to.equal(true);
    await player.goBack();
  });
});
