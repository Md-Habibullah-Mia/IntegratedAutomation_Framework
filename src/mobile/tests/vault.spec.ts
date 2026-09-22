import { expect } from 'chai';
import { HomeScreen } from '@mobile/screens/home.screen';
import { ProfileScreen } from '@mobile/screens/profile.screen';
import { VaultScreen } from '@mobile/screens/vault.screen';

// Assumes an already logged-in, already-verified session — never
// touches login, registration, or verification. Non-mutating: this
// account's vault is genuinely empty and stays that way here (no file
// is actually imported), so these checks are read-only.
describe('Vault (MemoryWave / Odiobuk Android app)', () => {
  const home = new HomeScreen();
  const profile = new ProfileScreen();
  const vault = new VaultScreen();

  beforeEach(async () => {
    await home.ensureDisplayed();
    await home.openProfile();
    const onProfile = await profile.isDisplayed();
    expect(onProfile, 'failed to reach Profile from Home in beforeEach').to.equal(true);
    await profile.openPrivateVault();
    const onVault = await vault.isDisplayed();
    expect(onVault, 'failed to reach Vault from Profile in beforeEach').to.equal(true);
  });

  it('VLT-001/VLT-003: Vault loads and shows the real encryption/verification status', async () => {
    const statusText = await vault.getStatusLineText();
    expect(statusText).to.include('AES-256-GCM');
    // This account is past First-Login Verification, so the status
    // should read "identity verified", not "verification pending".
    expect(statusText).to.include('identity verified');
  });

  it('VLT-004: empty vault shows the real empty state and import CTA', async () => {
    const importVisible = await vault.isImportButtonVisible();
    expect(importVisible).to.equal(true);
    const emptyVisible = await vault.isEmptyStateVisible();
    expect(emptyVisible).to.equal(true);
  });
});
