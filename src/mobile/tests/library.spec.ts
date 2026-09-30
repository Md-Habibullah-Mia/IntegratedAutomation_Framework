import { expect } from 'chai';
import { HomeScreen } from '@mobile/screens/home.screen';
import { LibraryScreen } from '@mobile/screens/library.screen';

// Assumes an already logged-in, already-verified session (see
// wdio.conf.ts noReset comment and home.spec.ts) — never touches login,
// registration, or verification.
describe('Library (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const library = new LibraryScreen();

  // The Public shelf's titles change as the store publishes content (it
  // showed the built-in sample shelf until real titles went live around
  // 2026-09-30), so LIB-004 checks row shapes rather than names.
  //
  // A store voice the account already has (Public → Voice row
  // "SU | Sumitra | Deep | Yours", verified live 2026-09-30).
  const OWNED_VOICE_NAME = 'Sumitra';
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
    expect(text).to.match(/^\d+ titles? · (yours to narrate|a preview of the store)$/);
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
    // Asserts each category's row *shape*, not specific titles: the store
    // went from the built-in sample shelf to real published titles
    // (2026-09-30: "And Then There Were None", "Sumitra", "the_hobbit"…),
    // and hardcoded names broke on that change.
    //   Audiobook: "{title}\n{genre} · {duration}\n{Yours|price}"
    //   Voice:     "{initials}\n{name}\n…"   (2-letter initials line)
    //   PDF:       "{filename}\n{n} pages\n{Yours|price}"
    // Rows are multi-line; the header "N titles · yours to narrate" is one
    // line, so requiring a newline keeps it out of the Audiobook match.
    const audiobookRow = '//*[contains(@content-desc,"\n") and contains(@content-desc," · ") and not(contains(@content-desc," pages"))]';
    const voiceRow = '//*[@content-desc and string-length(substring-before(@content-desc,"\n"))=2]';
    const pdfRow = '//*[contains(@content-desc,"\n") and contains(@content-desc," pages")]';

    // The app remembers the last category within a session, so select
    // Audiobook explicitly rather than assuming it is the default.
    await library.selectCategory('Audiobook');
    expect(await library.waitVisible(audiobookRow), 'Audiobook rows after tapping Audiobook').to.equal(true);
    expect(await library.isVisible(pdfRow), 'no PDF rows under Audiobook').to.equal(false);

    await library.selectCategory('Voice');
    expect(await library.waitVisible(voiceRow), 'Voice rows after tapping Voice').to.equal(true);
    expect(await library.isVisible(audiobookRow), 'no Audiobook rows under Voice').to.equal(false);

    await library.selectCategory('PDF');
    // The Public shelf's PDF category is the store catalogue, not the
    // account's own uploaded PDF — that only appears under the Your
    // Library shelf (see LIB-002b).
    expect(await library.waitVisible(pdfRow), 'PDF rows after tapping PDF').to.equal(true);
    expect(await library.isVisible(voiceRow), 'no Voice rows under PDF').to.equal(false);
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
