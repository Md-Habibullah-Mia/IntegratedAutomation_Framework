import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of AudiobookPlayerScreen —
// reached by tapping a row in AudiobooksScreen's own "Your audiobooks"
// history list. This is a *different*, simpler screen than
// player.screen.ts's "NOW PLAYING" UI (reached instead from Home's
// audiobook rail via NowPlayingController): no cover art, no eyebrow
// header, no speed/bookmark/sleep/text-sync/download row — just a title
// bar, an inline chapter button, a seek bar, and bare transport icons
// (none of which carry a content-desc — an accessibility gap, same
// pattern as elsewhere in this app).
const SELECTORS = {
  seekBar: '//android.widget.SeekBar',
  backButton: '~Back',
};

function chapterButtonSelector(n: number) {
  return `//*[starts-with(@content-desc,"${n}\nChapter ${n}")]`;
}

export class AudiobookPlayerScreen extends BaseMobileScreen {
  isTitleVisible(title: string) {
    return this.waitVisible(`~${title}`);
  }

  isFirstChapterButtonVisible() {
    return this.waitVisible(chapterButtonSelector(1));
  }

  isSeekBarVisible() {
    return this.waitVisible(SELECTORS.seekBar);
  }

  async goBack() {
    await this.click(SELECTORS.backButton);
  }
}
