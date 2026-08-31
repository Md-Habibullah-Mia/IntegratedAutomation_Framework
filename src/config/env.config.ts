import * as dotenv from 'dotenv';
import * as path from 'path';

// Loads .env.<ENV> so the same framework runs against dev/staging/prod
// without touching a single line of test code.
const envName = process.env.TEST_ENV || 'dev';
dotenv.config({ path: path.resolve(__dirname, `../../.env.${envName}`) });

export interface EnvConfig {
  env: string;
  webBaseUrl: string;
  apiBaseUrl: string;
  mobile: {
    platform: 'android' | 'ios';
    deviceName: string;
    platformVersion: string;
    appPath?: string;
    udid?: string;
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
  webBaseUrl: process.env.WEB_BASE_URL || 'https://example.com',
  apiBaseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  mobile: {
    platform: (process.env.MOBILE_PLATFORM as 'android' | 'ios') || 'android',
    deviceName: process.env.DEVICE_NAME || 'Pixel_7_API_34',
    platformVersion: process.env.PLATFORM_VERSION || '14.0',
    appPath: process.env.APP_PATH,
    udid: process.env.UDID,
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
