# Unified Automation Framework

A single, scalable framework for automating **web**, **mobile (iOS/Android)**, and **API** tests — one architecture, shared patterns, independent execution.

## Why this design

| Concern | Approach |
|---|---|
| Web UI | Playwright (TypeScript) — auto-waiting, multi-browser, fast, low flake |
| Mobile UI | Appium via WebdriverIO — same TS codebase, real devices or cloud |
| API | Playwright's request context — no browser overhead |
| Scaling execution | Parallel workers locally; BrowserStack/Sauce Labs or device farms in CI, no infra to maintain |
| Scaling maintenance | Page Object / Screen Object Model + a shared `core` layer so fixes happen once |
| Environments | `.env.<env>` files — same test code runs against dev/staging/prod by flag |

## Structure

```
src/
  config/     # env-aware config (URLs, devices, timeouts, cloud creds)
  core/       # BaseWebPage, BaseMobileScreen, ApiClient, logger — shared foundation
  web/        # Playwright: pages/ (POM) + tests/
  mobile/     # Appium/WebdriverIO: screens/ (Screen Object Model) + tests/
  api/        # Playwright request-based API tests
  utils/      # shared test data / helpers used by both web and mobile specs
```

`BaseWebPage` and `BaseMobileScreen` expose the **same method shape** (`click`, `type`, `isVisible`, `textOf`) so an engineer moving between web and mobile suites isn't learning two idioms — only the underlying driver differs.

## Setup

```bash
npm install
npx playwright install --with-deps   # web browsers
# Mobile: install Appium drivers (one-time)
npx appium driver install uiautomator2   # Android
npx appium driver install xcuitest       # iOS (macOS only)
```

Copy `.env.dev` to `.env.staging` / `.env.prod` as needed and adjust values.

## Running tests

```bash
npm run test:web          # all browsers, parallel
npm run test:web:ui       # Playwright UI mode (debugging)
npm run test:api          # API suite only
npm run test:mobile       # Appium suite (needs emulator/device or cloud creds)
npm run test:all          # everything
TEST_ENV=staging npm run test:web   # run against staging
```

## Scaling this further

1. **New web page** → add a class in `src/web/pages` extending `BaseWebPage`, add a spec in `src/web/tests`.
2. **New mobile screen** → same pattern in `src/mobile/screens` extending `BaseMobileScreen`.
3. **New environment** → add `.env.<name>`, run with `TEST_ENV=<name>`.
4. **More parallelism** → raise `PARALLEL_WORKERS`, or fan out CI matrix (already sharded by browser; extend similarly for mobile device matrix).
5. **Add visual regression / accessibility checks** → drop in `@playwright/test` + `axe-core`, wire into `base.page.ts` as an optional `checkA11y()` helper.
6. **Reporting at scale** → Allure results from all three suites write to the same `reports/allure-results` folder, so `allure generate` produces one unified report across web+mobile+API.

## CI/CD

`.github/workflows/ci.yml` runs three parallel jobs (web × 3 browsers, API, mobile-on-cloud) on every push/PR, uploads reports as artifacts, and accepts a manual `test_env` input for on-demand runs against staging/prod.

`docker/Dockerfile` packages the whole suite (Playwright's official image) so it runs identically anywhere — laptop, CI runner, or a scheduled job.

## Notes on this scaffold

This is a working skeleton with one real example (Login) fully wired end-to-end in each layer — replace selectors/URLs with your actual app's, then add pages/screens/specs following the same pattern. The architecture (not the Login example) is the part meant to scale.
