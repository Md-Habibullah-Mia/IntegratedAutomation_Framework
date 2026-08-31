import { defineConfig, devices } from '@playwright/test';
import { config } from './src/config/env.config';

export default defineConfig({
  testDir: './src/web/tests',
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
    baseURL: config.webBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Add mobile web emulation projects as needed:
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
