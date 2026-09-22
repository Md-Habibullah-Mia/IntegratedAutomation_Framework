import { config } from '@config/env.config';
import { BaseMobileScreen } from '@core/base.screen';

// Written from a live accessibility-tree dump (uiautomator) of the real
// app, not guessed. Two findings that shaped these selectors:
// - The email/password EditTexts carry no semantics label at all
//   (empty content-desc, NAF="true" in the dump) — a real accessibility
//   gap on the app's own sign-in form, not a test workaround. There's
//   nothing to target them by except position, hence UiSelector by class
//   + instance rather than accessibility id.
// - The post-submit error is a Flutter SnackBar whose semantics label
//   *is* the message text itself ("Invalid email or password."), so it's
//   matched by a content-desc XPath rather than getText().
const SELECTORS = {
  revealSignIn: '~I already have an account',
  emailInput: 'android=new UiSelector().className("android.widget.EditText").instance(0)',
  passwordInput: 'android=new UiSelector().className("android.widget.EditText").instance(1)',
  submitButton: '~Sign in',
  errorBanner: '//android.view.View[contains(@content-desc,"Invalid email or password")]',
};

export class LoginScreen extends BaseMobileScreen {
  async login(email: string, password: string) {
    // The sign-in form is collapsed behind this toggle on the auth
    // landing screen; only tap it if the form isn't already open.
    if (await this.isVisible(SELECTORS.revealSignIn)) {
      await this.click(SELECTORS.revealSignIn);
    }
    await this.type(SELECTORS.emailInput, email);
    await this.type(SELECTORS.passwordInput, password);
    await this.click(SELECTORS.submitButton);
  }

  async getErrorMessage(): Promise<string> {
    const el = await this.driver.$(SELECTORS.errorBanner);
    await el.waitForDisplayed({ timeout: config.timeouts.default });
    return el.getAttribute('content-desc');
  }
}
