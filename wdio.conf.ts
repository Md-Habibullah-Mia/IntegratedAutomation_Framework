import { config as envConfig } from './src/config/env.config';

const isAndroid = envConfig.mobile.platform === 'android';

const localCapability = isAndroid
  ? {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': envConfig.mobile.deviceName,
      'appium:platformVersion': envConfig.mobile.platformVersion,
      'appium:app': envConfig.mobile.appPath,
      'appium:autoGrantPermissions': true,
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
  maxInstances: envConfig.parallelWorkers,

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
