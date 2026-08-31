import { BaseMobileScreen } from '@core/base.screen';

// Android/iOS selector strategies differ (resource-id vs accessibility id).
// Centralizing them here keeps that platform difference out of the tests.
const SELECTORS = {
  emailInput: '~login-email',
  passwordInput: '~login-password',
  submitButton: '~login-submit',
  errorBanner: '~login-error',
};

export class LoginScreen extends BaseMobileScreen {
  async login(email: string, password: string) {
    await this.type(SELECTORS.emailInput, email);
    await this.type(SELECTORS.passwordInput, password);
    await this.click(SELECTORS.submitButton);
  }

  async getErrorMessage(): Promise<string> {
    return this.textOf(SELECTORS.errorBanner);
  }
}
