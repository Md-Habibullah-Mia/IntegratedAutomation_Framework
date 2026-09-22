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
describe('Audiobooks generation & playback (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const library = new LibraryScreen();
  const audiobooks = new AudiobooksScreen();
  const player = new AudiobookPlayerScreen();

  const CATALOGUE_TITLE = 'Ten Minutes to Six';
  const EXISTING_VOICE = 'Riad New';

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
    const voicePreselected = await audiobooks.isVoicePreselected(EXISTING_VOICE);
    expect(voicePreselected).to.equal(true);
  });

  it('AUD-021: Generate produces the real "Narration started" confirmation, using the existing voice', async () => {
    await library.openCatalogueAudiobook(CATALOGUE_TITLE);
    await library.tapNarrateInYourVoice();
    const onForm = await audiobooks.isDisplayed();
    expect(onForm, 'failed to reach the generation form').to.equal(true);

    await audiobooks.tapGenerate();
    const dialogVisible = await audiobooks.isSuccessDialogVisible();
    expect(dialogVisible).to.equal(true);
    await audiobooks.dismissSuccessDialog();

    // This backend generates short catalogue samples near-instantly in
    // this environment (observed live: "0.0 min"), despite the dialog's
    // own "10–15 minutes" copy — so DONE is a reasonable, real thing to
    // wait for here rather than only checking the task appears queued.
    const done = await audiobooks.isTaskDone(CATALOGUE_TITLE);
    expect(done).to.equal(true);
  });

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
