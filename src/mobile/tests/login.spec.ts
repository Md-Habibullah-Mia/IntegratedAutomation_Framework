import { expect } from 'chai';
import { LoginScreen } from '@mobile/screens/login.screen';
import { testUsers } from '@utils/data-provider';

describe('Mobile Login', () => {
  const screen = new LoginScreen();

  it('logs in successfully with valid credentials', async () => {
    await screen.login(testUsers.valid.email, testUsers.valid.password);
    const visible = await screen.isVisible('~dashboard-header');
    expect(visible).to.equal(true);
  });

  it('shows an error with invalid credentials', async () => {
    await screen.login(testUsers.invalid.email, testUsers.invalid.password);
    const error = await screen.getErrorMessage();
    expect(error).to.include('Invalid');
  });
});
