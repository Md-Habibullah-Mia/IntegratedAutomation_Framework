import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of VoicesScreen and its two
// dialogs (Register, Lend consent). Multiple rows can share the same
// "Register"/"Lend" button label (several unregistered sessions, several
// ready voices), so these selectors intentionally match the *first*
// instance — fine for exercising the dialog flow itself, not for
// targeting one specific row.
const SELECTORS = {
  header: '~Voices',
  tagline: '~The people who read to you.',
  recordCta: '//*[starts-with(@content-desc,"Record your voice")]',
  yourVoicesSection: '~YOUR VOICES',
  registerButton: '~Register',
  lendButton: '~Lend',
  registerDialogTitle: '~Name this voice',
  registerCancelButton: '~Cancel',
  lendNotNowButton: '~Not now',
  lendAgreeButton: '~I agree',
};

export class VoicesScreen extends BaseMobileScreen {
  isDisplayed() {
    return this.waitVisible(SELECTORS.header);
  }

  isTaglineVisible() {
    return this.waitVisible(SELECTORS.tagline);
  }

  isRecordCtaVisible() {
    return this.waitVisible(SELECTORS.recordCta);
  }

  isYourVoicesSectionVisible() {
    return this.isVisible(SELECTORS.yourVoicesSection);
  }

  // Row content-desc is "{initials}\n{name}\n{status}" — matched by
  // name + status fragment since initials/status vary.
  voiceRow(name: string, statusFragment: string) {
    return `//*[contains(@content-desc,"${name}") and contains(@content-desc,"${statusFragment}")]`;
  }

  async openFirstRegisterDialog() {
    await this.click(SELECTORS.registerButton);
  }

  isRegisterDialogVisible() {
    return this.waitVisible(SELECTORS.registerDialogTitle);
  }

  async cancelRegisterDialog() {
    await this.click(SELECTORS.registerCancelButton);
  }

  async openFirstLendDialog() {
    await this.click(SELECTORS.lendButton);
  }

  isLendConsentTextVisible() {
    return this.waitVisible('//*[contains(@content-desc,"I am lending my voice")]');
  }

  isLendDialogTitleVisible(voiceName: string) {
    return this.waitVisible(`~Lend "${voiceName}"?`);
  }

  async declineLendDialog() {
    await this.click(SELECTORS.lendNotNowButton);
  }
}
