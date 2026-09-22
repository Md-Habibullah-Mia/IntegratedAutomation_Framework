import { expect } from 'chai';
import { HomeScreen } from '@mobile/screens/home.screen';
import { LibraryScreen } from '@mobile/screens/library.screen';

// Assumes an already logged-in, already-verified session (see
// wdio.conf.ts noReset comment and home.spec.ts) — never touches login,
// registration, or verification.
describe('Library (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const library = new LibraryScreen();

  // Real account content used as ground truth (verified live): Public
  // shelf defaults to the Voice category, showing an owned voice
  // ("Soumitra … Yours") and an unowned free one ("Soumitra … Free") —
  // two distinct rows sharing a display name, disambiguated by the
  // ownership fragment in their content-desc.
  const OWNED_VOICE_NAME = 'Soumitra';
  const OWNED_FRAGMENT = 'Yours';

  beforeEach(async () => {
    await home.ensureDisplayed();
    await home.openLibrary();
    const onLibrary = await library.isDisplayed();
    expect(onLibrary, 'failed to reach Library from Home in beforeEach').to.equal(true);
    // Tests mutate shelf/category state; start every test from the same
    // known baseline (Public shelf) rather than assuming prior state.
    await library.openPublicShelf();
  });

  it('LIB-002a: Public shelf header shows a real title count', async () => {
    const text = await library.getCountLineText();
    expect(text).to.match(/^\d+ titles? · yours to narrate$/);
  });

  it('LIB-002b / LIB-003: Your Library shelf shows a real item count and its own dashed actions', async () => {
    await library.openYourLibraryShelf();
    const text = await library.getCountLineText();
    expect(text).to.match(/^(Nothing of yours here yet|\d+ items? · yours to narrate)$/);
    const addPdfVisible = await library.isAddPdfActionVisible();
    expect(addPdfVisible).to.equal(true);
    const narrateTextVisible = await library.isNarrateTextActionVisible();
    expect(narrateTextVisible).to.equal(true);
  });

  it('LIB-004: category chips switch which rows are shown on the Public shelf', async () => {
    // Default category on a fresh Library visit is Audiobook (verified
    // live — do not assume Voice, which only appeared true in an earlier
    // mid-session exploration after prior manual taps).
    const audiobookRowVisible = await library.waitVisible(
      '//*[contains(@content-desc,"The Prince") and contains(@content-desc,"Political Philosophy")]'
    );
    expect(audiobookRowVisible).to.equal(true);

    await library.selectCategory('Voice');
    const voiceRowVisible = await library.waitVisible(library.voiceRow(OWNED_VOICE_NAME, OWNED_FRAGMENT));
    expect(voiceRowVisible).to.equal(true);

    await library.selectCategory('PDF');
    // The Public shelf's PDF category is the store catalogue (sample
    // titles like "The Hobbit"), not the account's own uploaded PDF —
    // that only appears under the Your Library shelf (see LIB-002b).
    // Confirmed live before writing this assertion.
    const pdfRowVisible = await library.waitVisible(
      '//*[contains(@content-desc,"The Hobbit") and contains(@content-desc,"pages")]'
    );
    expect(pdfRowVisible).to.equal(true);
  });

  it('LIB-011: tapping an already-owned voice shows a toast, not the acquire dialog', async () => {
    await library.selectCategory('Voice');
    await library.tapVoiceRow(OWNED_VOICE_NAME, OWNED_FRAGMENT);
    const toastVisible = await library.waitVisible(
      `//*[contains(@content-desc,"${OWNED_VOICE_NAME}") and contains(@content-desc,"already in your voice picker")]`
    );
    expect(toastVisible).to.equal(true);
    // No acquire dialog should have appeared alongside it.
    const dialogVisible = await library.isVisible('~Add it');
    expect(dialogVisible).to.equal(false);
  });
});
