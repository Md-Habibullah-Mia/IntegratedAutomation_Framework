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
};

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

  async tapGenerate() {
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
  }

  isSuccessDialogVisible() {
    return this.waitVisible(SELECTORS.successDialogTitle);
  }

  async dismissSuccessDialog() {
    await this.click(SELECTORS.successDialogOk);
  }

  // Task/history row content-desc is "{title}\n{date}, {time} ·
  // {duration} · {N} ch.\n{STATUS}" — matched by title prefix.
  taskRow(title: string) {
    return `//*[starts-with(@content-desc,"${title}")]`;
  }

  isTaskDone(title: string) {
    return this.waitVisible(`//*[starts-with(@content-desc,"${title}") and contains(@content-desc,"DONE")]`, 30000);
  }

  async openTask(title: string) {
    // Full-width row — same dead-zone family as the catalogue rows.
    await this.clickNearStart(this.taskRow(title));
  }
}
