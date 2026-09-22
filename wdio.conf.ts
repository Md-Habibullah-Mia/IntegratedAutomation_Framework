import { config as envConfig } from './src/config/env.config';

const isAndroid = envConfig.mobile.platform === 'android';

const localCapability = isAndroid
  ? {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': envConfig.mobile.deviceName,
      'appium:platformVersion': envConfig.mobile.platformVersion,
      'appium:app': envConfig.mobile.appPath,
      'appium:appPackage': envConfig.mobile.appPackage,
      'appium:appActivity': envConfig.mobile.appActivity,
      'appium:autoGrantPermissions': true,
      // true: preserves app data (login session + the locally-tracked
      // First-Login Verification flag, see auth_service.dart) between
      // Appium sessions, so post-login suites (home/library/audiobooks/
      // voices/profile/vault) can run against an already-authenticated,
      // already-verified account without re-touching login or the live
      // biometric check. An earlier attempt at this looked like it didn't
      // work, but that test never actually completed verification (it
      // only asserted the screen appeared) — isVerified is genuinely
      // local-only and persists fine once really set. Only run
      // login.spec.ts / registration.spec.ts with this explicitly flipped
      // back to false (or after confirming with the user), since a
      // logged-in session skips the login form those tests expect.
      'appium:noReset': true,
      // Leave UDID unset to auto-pick whichever single emulator/device is
      // connected (`adb devices`); set UDID in .env when more than one is
      // attached and a specific one must be targeted — same config either
      // way, no code change needed to switch between emulator and a real
      // Android phone.
      ...(envConfig.mobile.udid ? { 'appium:udid': envConfig.mobile.udid } : {}),
      // If no device/emulator is already running, Appium boots this AVD
      // itself rather than failing with "no devices attached".
      ...(envConfig.mobile.avdName ? { 'appium:avd': envConfig.mobile.avdName } : {}),
    }
  : {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': envConfig.mobile.deviceName,
      'appium:platformVersion': envConfig.mobile.platformVersion,
      'appium:app': envConfig.mobile.appPath,
      'appium:udid': envConfig.mobile.udid,
    };

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./src/mobile/tests/**/*.spec.ts'],
  // Deliberately 1, not envConfig.parallelWorkers (shared with the web
  // suite, where it's fine — multiple browser instances are independent).
  // Mobile specs all target the same single emulator/device; running two
  // spec files concurrently means two Appium sessions fighting over one
  // device, which crashes the second session's UiAutomator2 instrumentation
  // process outright rather than just running slowly.
  maxInstances: 1,

  // Scale path: swap to BrowserStack/Sauce Labs by setting CLOUD_PROVIDER
  // env var — hostname/user/key below flip automatically, specs untouched.
  ...(envConfig.cloud.provider === 'browserstack'
    ? {
        user: envConfig.cloud.user,
        key: envConfig.cloud.key,
        hostname: 'hub-cloud.browserstack.com',
      }
    : {}),

  capabilities: [localCapability as WebdriverIO.Capabilities],

  logLevel: 'info',
  waitforTimeout: envConfig.timeouts.default,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  services: envConfig.cloud.provider === 'local' ? ['appium'] : [],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  reporters: [
    'spec',
    ['allure', { outputDir: 'reports/allure-results' }],
  ],
};
