import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// Relative (not @config/…) import: this file also runs standalone via
// ts-node, outside wdio/playwright, where tsconfig path aliases aren't
// registered.
import { config } from '../config/env.config';

// Gets an automated account past "First-Login Verification" without the
// live face + voice liveness check, by pre-seeding the exact local flag
// the app itself writes on success.
//
// Why this works (read from the app's own source, Audiobook-mobile
// lib/services/auth_service.dart): isVerified has no server-side
// equivalent — markCurrentUserVerified() just does
// `prefs.setBool('verified_v1_<userId>', true)` in plain (unencrypted)
// shared_preferences, and _buildUser() reads it back on every login and
// session restore. Flutter's shared_preferences stores that as
// `flutter.verified_v1_<userId>` in FlutterSharedPreferences.xml. The
// access/refresh tokens, by contrast, live in flutter_secure_storage
// (Keystore-encrypted, device-bound) — so the session itself can't be
// seeded and still needs one real UI login afterwards.
//
// Needs a rootable emulator image (`google_apis`, NOT
// `google_apis_playstore`) for `adb root`. Run it with no Appium session
// attached: `adb root` restarts adbd, which drops UiAutomator2's port
// forward mid-session.

const PREFS_FILE = 'FlutterSharedPreferences.xml';

function adb(...args: string[]): string {
  const target = config.mobile.udid ? ['-s', config.mobile.udid] : [];
  return execFileSync('adb', [...target, ...args], { encoding: 'utf8' }).trim();
}

/** The flag is keyed by backend user id, so resolve it from a real login. */
export async function fetchMobileTestUserId(): Promise<string> {
  const { email, password } = config.mobile.testAccount;
  if (!email || !password) {
    throw new Error('MOBILE_TEST_EMAIL / MOBILE_TEST_PASSWORD must be set to seed the verified flag');
  }
  const res = await fetch(`${config.odiobukApiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login for ${email} failed with HTTP ${res.status} — cannot resolve user id`);
  }
  const body = (await res.json()) as { user?: { id?: string } };
  const id = body.user?.id;
  if (!id) throw new Error('Login response had no user.id');
  return id;
}

/** Merges `flutter.verified_v1_<userId>=true` into the app's prefs file. */
export function buildPrefsXml(existing: string, userId: string): string {
  const key = `flutter.verified_v1_${userId}`;
  const entry = `    <boolean name="${key}" value="true" />`;
  if (!existing.includes('<map')) {
    return `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n${entry}\n</map>\n`;
  }
  if (existing.includes('<map />')) {
    return existing.replace('<map />', `<map>\n${entry}\n</map>`);
  }
  const withoutOld = existing.replace(new RegExp(`\\s*<boolean name="${key}"[^>]*/>`), '');
  return withoutOld.replace('</map>', `${entry}\n</map>`);
}

export function seedVerifiedFlag(userId: string) {
  const pkg = config.mobile.appPackage as string;
  const dataDir = `/data/data/${pkg}`;
  const prefsDir = `${dataDir}/shared_prefs`;
  const prefsPath = `${prefsDir}/${PREFS_FILE}`;

  adb('root');
  adb('wait-for-device');
  // Android's SharedPreferences caches the file in-process — a running
  // app would ignore (and later overwrite) the edited file.
  adb('shell', 'am', 'force-stop', pkg);

  const existing = adb('shell', `cat ${prefsPath} 2>/dev/null || true`);
  const tmpLocal = path.join(os.tmpdir(), PREFS_FILE);
  fs.writeFileSync(tmpLocal, buildPrefsXml(existing, userId), 'utf8');
  adb('push', tmpLocal, `/data/local/tmp/${PREFS_FILE}`);

  // Owned by the app's own uid (not root) and carrying the app data dir's
  // exact SELinux label, or the app can't read the file at all. Copied
  // from the dir rather than `restorecon`: restorecon (confirmed live)
  // drops the per-app MLS categories (s0:c192,c256,… → bare s0).
  adb(
    'shell',
    [
      `mkdir -p ${prefsDir}`,
      `cp /data/local/tmp/${PREFS_FILE} ${prefsPath}`,
      `owner=$(stat -c %u:%g ${dataDir})`,
      `chown $owner ${prefsDir} ${prefsPath}`,
      `chmod 771 ${prefsDir}`,
      `chmod 660 ${prefsPath}`,
      `chcon $(stat -c %C ${dataDir}) ${prefsDir} ${prefsPath}`,
      `rm /data/local/tmp/${PREFS_FILE}`,
    ].join(' && ')
  );

  const written = adb('shell', `cat ${prefsPath}`);
  if (!written.includes(`flutter.verified_v1_${userId}`)) {
    throw new Error(`Verified flag not present in ${prefsPath} after seeding`);
  }
}

// Standalone entry point (CI runs this between wdio invocations):
//   npx ts-node --transpile-only src/utils/mobile-verified-seed.ts [--clear]
// --clear wipes app data first (`pm clear`), e.g. to drop whatever session
// registration.spec.ts left behind before seeding the real test account.
if (require.main === module) {
  (async () => {
    if (process.argv.includes('--clear')) {
      adb('shell', 'pm', 'clear', config.mobile.appPackage as string);
    }
    const userId = await fetchMobileTestUserId();
    seedVerifiedFlag(userId);
    console.log(`Seeded First-Login Verification flag for user ${userId}`);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
