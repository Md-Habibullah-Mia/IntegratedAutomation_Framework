import { expect } from 'chai';
import { HomeScreen } from '@mobile/screens/home.screen';
import { ProfileScreen } from '@mobile/screens/profile.screen';
import { VaultScreen } from '@mobile/screens/vault.screen';

// Assumes an already logged-in, already-verified session (see
// wdio.conf.ts noReset comment and home.spec.ts) — never touches login,
// registration, or verification. Deliberately avoids Log out and Delete
// my account entirely (never tapped, not even to test a confirm/cancel
// dialog), and the Upgrade flow is only ever declined ("Not now"),
// matching the standing instruction not to disturb the live session or
// account state.
describe('Profile (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const profile = new ProfileScreen();
  const vault = new VaultScreen();

  beforeEach(async () => {
    await home.ensureDisplayed();
    await home.openProfile();
    const onProfile = await profile.isDisplayed();
    expect(onProfile, 'failed to reach Profile from Home in beforeEach').to.equal(true);
  });

  it('PROF-001: Profile loads with real identity, stats, usage, and premium cards', async () => {
    const identityVisible = await profile.isIdentityVisible();
    expect(identityVisible).to.equal(true);
    const identity = await profile.getIdentityText();
    expect(identity).to.match(/^K\n.+\nMember — (Free|Premium) Edition$/);

    const statsVisible = await profile.isStatsLineVisible();
    expect(statsVisible).to.equal(true);

    const usageText = await profile.getUsageCardText();
    expect(usageText).to.include('USAGE');
    expect(usageText).to.include('AI voices');

    const premiumText = await profile.getPremiumCardText();
    expect(premiumText).to.include('PREMIUM EDITION');
    expect(premiumText).to.include('$9.99');
  });

  it('PROF-028: Account section shows real sign-in method and membership info', async () => {
    const accountText = await profile.getAccountCardText();
    expect(accountText).to.include('Signs in with');
    expect(accountText).to.include('Email & password');
    expect(accountText).to.include('Member since');
    expect(accountText).to.include('Private vault');
  });

  it('PROF-019: declining the Upgrade dialog makes no plan change', async () => {
    const beforeIdentity = await profile.getIdentityText();
    await profile.tapUpgrade();
    const dialogVisible = await profile.isUpgradeDialogVisible();
    expect(dialogVisible).to.equal(true);
    await profile.declineUpgradeDialog();
    const afterIdentity = await profile.getIdentityText();
    expect(afterIdentity).to.equal(beforeIdentity);
  });

  it('PROF-029: "Private vault" navigates to the real Vault screen', async () => {
    await profile.openPrivateVault();
    const onVault = await vault.isDisplayed();
    expect(onVault).to.equal(true);
    await vault.goBack();
    const backOnProfile = await profile.isDisplayed();
    expect(backOnProfile).to.equal(true);
  });
});
