import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Allow Argon2id key derivation + form resolution + badge animation
  timeout: 60_000,
  expect: { timeout: 15_000 },

  // Extension tests must run serially — each file creates its own browser
  // context but shares the Playwright runner process.
  fullyParallel: false,
  workers: 1,

  retries: 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // Extensions require a headed (or --headless=new) Chrome context.
    // Run in a visible window so extension service workers start reliably.
    headless: false,
    viewport:   { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
  },

  // Global output dir for traces / videos / screenshots
  outputDir: 'test-results',
});
