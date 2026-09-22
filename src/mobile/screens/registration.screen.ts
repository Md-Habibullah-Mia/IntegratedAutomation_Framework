import { BaseMobileScreen } from '@core/base.screen';

// Reached from the auth landing screen via "Begin with Email". Written
// from a live accessibility dump, same as login.screen.ts — the four
// inputs are plain EditTexts with no semantics label (same accessibility
// gap noted there), selected by class + instance in field order (Full
// name, Email, Password, Confirm password).
const SELECTORS = {
  fullNameInput: 'android=new UiSelector().className("android.widget.EditText").instance(0)',
  emailInput: 'android=new UiSelector().className("android.widget.EditText").instance(1)',
  passwordInput: 'android=new UiSelector().className("android.widget.EditText").instance(2)',
  confirmPasswordInput: 'android=new UiSelector().className("android.widget.EditText").instance(3)',
  submitButton: '~Create my MemoryWave',
  nameRequiredError: '~Name is required',
  emailRequiredError: '~Email is required',
  passwordTooShortError: '~Password must be at least 8 characters',
  passwordMismatchError: '~Passwords do not match',
  emailFormatError: '~Enter a valid email',
  duplicateEmailError: '//android.view.View[contains(@content-desc,"already exists")]',
};

export class RegistrationScreen extends BaseMobileScreen {
  // "Begin with Email" lives on the same auth-landing screen
  // OnboardingScreen stops at; safe to call regardless of whether it's
  // already open (e.g. a retry within the same test).
  async open() {
    if (await this.isVisible('~Begin with Email')) {
      await this.click('~Begin with Email');
    }
  }

  async register(fullName: string, email: string, password: string, confirmPassword: string) {
    await this.type(SELECTORS.fullNameInput, fullName);
    await this.type(SELECTORS.emailInput, email);
    await this.type(SELECTORS.passwordInput, password);
    await this.type(SELECTORS.confirmPasswordInput, confirmPassword);
    await this.click(SELECTORS.submitButton);
  }

  isNameRequiredErrorVisible() {
    return this.isVisible(SELECTORS.nameRequiredError);
  }

  isEmailRequiredErrorVisible() {
    return this.isVisible(SELECTORS.emailRequiredError);
  }

  isPasswordTooShortErrorVisible() {
    return this.isVisible(SELECTORS.passwordTooShortError);
  }

  isPasswordMismatchErrorVisible() {
    return this.isVisible(SELECTORS.passwordMismatchError);
  }

  isEmailFormatErrorVisible() {
    return this.isVisible(SELECTORS.emailFormatError);
  }

  async isDuplicateEmailErrorVisible(): Promise<boolean> {
    const el = await this.driver.$(SELECTORS.duplicateEmailError);
    return el.waitForDisplayed({ timeout: 10000 }).catch(() => false);
  }
}
