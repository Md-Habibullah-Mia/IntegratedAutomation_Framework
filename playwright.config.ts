import { defineConfig, devices } from '@playwright/test';
import { config } from './src/config/env.config';

// Each site gets its own testDir + baseURL, crossed with the browser matrix,
// so the two portals run as fully independent suites sharing one framework.
const sites = [
  { key: 'medco', testDir: './src/web/medco/tests', baseURL: config.medcoWebBaseUrl },
  { key: 'massive-market', testDir: './src/web/massive-market/tests', baseURL: config.massiveMarketWebBaseUrl },
  { key: 'odiobuk', testDir: './src/web/odiobuk/tests', baseURL: config.odiobukWebBaseUrl },
];

const browsers = [
  { key: 'chromium', use: devices['Desktop Chrome'] },
  { key: 'firefox', use: devices['Desktop Firefox'] },
  { key: 'webkit', use: devices['Desktop Safari'] },
  { key: 'mobile-chrome', use: devices['Pixel 7'] },
];

export default defineConfig({
  timeout: config.timeouts.default * 2,
  fullyParallel: true,
  workers: config.parallelWorkers,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'reports/html' }],
    ['allure-playwright', { outputFolder: 'reports/allure-results' }],
    ['list'],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: sites.flatMap((site) =>
    browsers.map((browser) => ({
      name: `${site.key}-${browser.key}`,
      testDir: site.testDir,
      use: {
        ...browser.use,
        baseURL: site.baseURL,
      },
    }))
  ),
});
