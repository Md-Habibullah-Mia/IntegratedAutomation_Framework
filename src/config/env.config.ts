import * as dotenv from 'dotenv';
import * as path from 'path';

// Loads .env.<ENV> so the same framework runs against dev/staging/prod
// without touching a single line of test code. .env.<ENV>.local (gitignored)
// layers in secrets — dotenv never overwrites a key already set, so it only
// fills in what the committed file left out.
const envName = process.env.TEST_ENV || 'dev';
dotenv.config({ path: path.resolve(__dirname, `../../.env.${envName}`) });
dotenv.config({ path: path.resolve(__dirname, `../../.env.${envName}.local`) });

export interface EnvConfig {
  env: string;
  medcoWebBaseUrl: string;
  massiveMarketWebBaseUrl: string;
  odiobukWebBaseUrl: string;
  odiobukApiBaseUrl: string;
  massiveMarket: {
    adminEmail?: string;
    adminPassword?: string;
  };
  mobile: {
    platform: 'android' | 'ios';
    deviceName: string;
    platformVersion: string;
    appPath?: string;
    udid?: string;
    // Android only: tells Appium which AVD to boot when nothing is
    // running yet, instead of requiring one to already be attached.
    avdName?: string;
    appPackage?: string;
    appActivity?: string;
    // A provisioned MemoryWave/Odiobuk account that has already completed
    // its one-time face & voice verification — undefined until one is
    // provisioned, in which case the valid-login test stays skipped.
    testAccount: {
      email?: string;
      password?: string;
    };
    adminAccount: {
      email?: string;
      password?: string;
    };
  };
  cloud: {
    provider: 'local' | 'browserstack' | 'saucelabs';
    user?: string;
    key?: string;
  };
  timeouts: {
    default: number;
    navigation: number;
  };
  parallelWorkers: number;
}

export const config: EnvConfig = {
  env: envName,
  medcoWebBaseUrl: process.env.MEDCO_WEB_BASE_URL || 'https://example.com',
  massiveMarketWebBaseUrl: process.env.MASSIVE_MARKET_WEB_BASE_URL || 'https://example.com',
  odiobukWebBaseUrl: process.env.ODIOBUK_WEB_BASE_URL || 'https://example.com',
  odiobukApiBaseUrl: process.env.ODIOBUK_API_BASE_URL || 'https://api.example.com',
  massiveMarket: {
    adminEmail: process.env.MASSIVE_MARKET_ADMIN_EMAIL,
    adminPassword: process.env.MASSIVE_MARKET_ADMIN_PASSWORD,
  },
  mobile: {
    platform: (process.env.MOBILE_PLATFORM as 'android' | 'ios') || 'android',
    deviceName: process.env.DEVICE_NAME || 'Pixel_7_API_34',
    platformVersion: process.env.PLATFORM_VERSION || '14.0',
    appPath: process.env.APP_PATH,
    udid: process.env.UDID,
    avdName: process.env.AVD_NAME,
    // Defaults match the Odiobuk mobile prototype (com.ad.audio_book /
    // MainActivity) — override via env if APP_PATH ever points elsewhere.
    appPackage: process.env.APP_PACKAGE || 'com.ad.audio_book',
    appActivity: process.env.APP_ACTIVITY || '.MainActivity',
    testAccount: {
      email: process.env.MOBILE_TEST_EMAIL,
      password: process.env.MOBILE_TEST_PASSWORD,
    },
    adminAccount: {
      email: process.env.MOBILE_TEST_ADMIN_EMAIL,
      password: process.env.MOBILE_TEST_ADMIN_PASSWORD,
    },
  },
  cloud: {
    provider: (process.env.CLOUD_PROVIDER as EnvConfig['cloud']['provider']) || 'local',
    user: process.env.CLOUD_USER,
    key: process.env.CLOUD_KEY,
  },
  timeouts: {
    default: Number(process.env.DEFAULT_TIMEOUT) || 15000,
    navigation: Number(process.env.NAV_TIMEOUT) || 30000,
  },
  parallelWorkers: Number(process.env.PARALLEL_WORKERS) || 4,
};
