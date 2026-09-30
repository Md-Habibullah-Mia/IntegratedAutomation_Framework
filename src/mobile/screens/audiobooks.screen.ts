import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of AudiobooksScreen (the
// generation form), reached via a catalogue book's "Narrate in your
// voice" button. The whole form is one Flutter-merged semantics block
// for reading ("New audiobook\nVOICE\nTITLE\n...\nSOURCE\n..."), but the
// interactive controls inside it (voice button, title field, Generate
// button) each carry their own real, individually-tappable node — no
// dead-zone issue here, unlike the full-width list rows elsewhere.
const SELECTORS = {
  header: '~Audiobooks',
  formSummary: '//*[starts-with(@content-desc,"New audiobook")]',
  generateButton: '~Generate audiobook',
  successDialogTitle: '~Narration started',
  successDialogOk: '~OK',
  // History card, newest row first. Its semantics come in two shapes
  // (both verified live 2026-09-30):
  //  - several rows: each row is its own clickable node,
  //    "{title}\n{date} · {min} · {n} ch.\n{STATUS}" (under a plain
  //    "Your audiobooks" header node);
  //  - a single row: Flutter merges header + row into ONE clickable node,
  //    "Your audiobooks\n{title}\n{meta}\n{STATUS}".
  history: '//*[starts-with(@content-desc,"Your audiobooks")]',
  refresh: '~Refresh',
};

export interface HistoryRow {
  title: string;
  meta: string;
  status: string;
}

/** Merged single-row card: row centre below the card's top edge, as a share of screen width (273px on a 1080px Pixel 7). */
const MERGED_ROW_OFFSET_OF_WIDTH = 273 / 1080;

const decode = (s: string) =>
  s.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export class AudiobooksScreen extends BaseMobileScreen {
  isDisplayed() {
    return this.waitVisible(SELECTORS.header);
  }

  async getFormSummaryText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.formSummary);
    return el.getAttribute('content-desc');
  }

  // The voice-picker button's own label IS the selected voice's name
  // (e.g. "Riad New"), so this doubles as "which voice is preselected".
  isVoicePreselected(voiceName: string) {
    return this.waitVisible(`~${voiceName}`);
  }

  /** The voice picker fills in after the form opens ("Loading your voices…"). */
  async waitForVoicesLoaded(timeout = 20000) {
    await this.driver.waitUntil(async () => !(await this.getFormSummaryText()).includes('Loading your voices'), {
      timeout,
      timeoutMsg: 'voice picker still "Loading your voices…"',
    });
  }

  async tapGenerate() {
    // Tapping before the voice loads submits nothing (no dialog).
    await this.waitForVoicesLoaded();
    await this.click(SELECTORS.generateButton);
    // Tapping Generate fires a network call and the "Narration started"
    // dialog's own entry animation at the same time. Confirmed live via
    // adb (uiautomator dump immediately after the tap): the dialog node
    // is there and its content-desc matches exactly, but UiAutomator2 can
    // time out fetching the accessibility tree while that transition is
    // still running ("hogging the main UI thread" — same failure class as
    // HomeScreen.ensureDisplayed's restart wait). A short settle pause
    // here, before the caller checks for the dialog, avoids querying
    // mid-animation.
    await this.driver.pause(1500);
    // The first Generate after a fresh install asks for Android's
    // notification permission (the app notifies when a narration is
    // done), and that system dialog covers "Narration started". Allow it,
    // as a user would.
    const allow = await this.driver.$('id=com.android.permissioncontroller:id/permission_allow_button');
    if (await allow.isDisplayed().catch(() => false)) {
      await allow.click();
      await this.driver.pause(1000);
    }
  }

  /**
   * The app runs one narration at a time ("A narration is already
   * running…"), so a new Generate needs every row settled first. Refreshes
   * while waiting; returns false if something is still QUEUED/RUNNING.
   */
  async waitUntilNoNarrationRunning(timeout = 180000): Promise<boolean> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const rows = await this.historyRows();
      if (!rows.some((r) => /QUEUED|RUNNING/.test(r.status))) return true;
      if (await this.isVisible(SELECTORS.refresh)) await this.click(SELECTORS.refresh);
      await this.driver.pause(10000);
    }
    return false;
  }

  isSuccessDialogVisible() {
    return this.waitVisible(SELECTORS.successDialogTitle);
  }

  async dismissSuccessDialog() {
    await this.click(SELECTORS.successDialogOk);
  }

  /**
   * History rows currently on screen, newest first — handles both semantics
   * shapes (see SELECTORS.history). Read from one page-source snapshot.
   */
  async historyRows(): Promise<HistoryRow[]> {
    const source = await this.driver.getPageSource();
    const rows: HistoryRow[] = [];
    for (const [, raw] of source.matchAll(/content-desc="([^"]*)"/g)) {
      const lines = decode(raw).split('\n');
      if (lines[0] === 'Your audiobooks' && lines.length > 1) {
        for (let i = 1; i < lines.length; i += 3) {
          if (lines[i]) rows.push({ title: lines[i], meta: lines[i + 1] ?? '', status: lines[i + 2] ?? '' });
        }
      } else if (lines.length === 3 && /^[A-Z]{3,}$/.test(lines[2])) {
        rows.push({ title: lines[0], meta: lines[1], status: lines[2] });
      }
    }
    return rows;
  }

  /**
   * Waits until the newest row is `title` and DONE and is a NEW row — its
   * timestamp line differs from `previousNewestMeta` (only on-screen rows
   * are in the tree, so counting rows can't tell). Taps Refresh while waiting.
   */
  async isTaskDone(title: string, previousNewestMeta?: string, timeout = 120000): Promise<boolean> {
    const stamp = (meta?: string) => meta?.split(' · ')[0];
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const newest = (await this.historyRows())[0];
      if (newest?.title === title && newest.status === 'DONE' && stamp(newest.meta) !== stamp(previousNewestMeta)) return true;
      if (await this.isVisible(SELECTORS.refresh)) await this.click(SELECTORS.refresh);
      await this.driver.pause(10000);
    }
    return false;
  }

  /** Opens the newest DONE history row titled `title`. */
  async openTask(title: string) {
    // The card starts below the form; bring its rows on screen. The list
    // loads after the form and the swipe flings, so read it until it settles.
    await this.swipe('up');
    let rows: HistoryRow[] = [];
    for (let i = 0; i < 10 && !rows.some((r) => r.title === title && r.status === 'DONE'); i += 1) {
      await this.driver.pause(1000);
      rows = await this.historyRows();
    }
    if (!rows.some((r) => r.title === title && r.status === 'DONE')) {
      throw new Error(`No DONE "${title}" in the history: ${JSON.stringify(rows)}`);
    }
    const ownNode = `//*[@clickable="true" and starts-with(@content-desc,"${title}\n") and contains(@content-desc,"\nDONE")]`;
    if (await this.isVisible(ownNode)) {
      await this.clickNearStart(ownNode);
      return;
    }
    // Single-row card: the row has no node of its own — tap inside the merged one.
    const el = await this.driver.$(SELECTORS.history);
    const { x, y } = await el.getLocation();
    const { width } = await this.driver.getWindowRect();
    await this.driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.round(x + 60), y: Math.round(y + width * MERGED_ROW_OFFSET_OF_WIDTH) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 80 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
  }
}
