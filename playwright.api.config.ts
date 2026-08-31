import { defineConfig } from '@playwright/test';
import { config } from './src/config/env.config';

export default defineConfig({
  testDir: './src/api/tests',
  timeout: config.timeouts.default,
  fullyParallel: true,
  workers: config.parallelWorkers,
  reporter: [
    ['html', { outputFolder: 'reports/api-html' }],
    ['allure-playwright', { outputFolder: 'reports/allure-results' }],
    ['list'],
  ],
  use: {
    baseURL: config.apiBaseUrl,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
});
