import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of AudiobookPlayerScreen,
// reached by tapping a playable audiobook tile from Home/Library. The
// transport buttons (play/pause, skip, prev/next) carry no content-desc
// at all — an accessibility gap, same pattern as the login/registration
// input fields — so only the informational elements are selectable here.
const SELECTORS = {
  nowPlayingHeader: '~NOW PLAYING',
  chapterPill: '//*[starts-with(@content-desc,"Chapter ")]',
};

export class PlayerScreen extends BaseMobileScreen {
  isDisplayed() {
    return this.waitVisible(SELECTORS.nowPlayingHeader);
  }

  isTitleVisible(title: string) {
    return this.isVisible(`~${title}`);
  }

  isChapterPillVisible() {
    return this.isVisible(SELECTORS.chapterPill);
  }
}
