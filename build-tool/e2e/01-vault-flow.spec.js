/**
 * EnigmAgent E2E — 01: Core vault flow
 *
 * Tests:
 *  1. Create vault → add secrets → form submit → real values injected
 *  2. Real values NOT present in the DOM before submit
 *  3. Output panel shows decrypted values, never the reference tokens
 */

import { test, expect }                    from '@playwright/test';
import { launchWithExtension, cleanupProfile } from './helpers/launch.js';
import { startServer }                     from './helpers/server.js';
import { createVaultAndAddSecrets, waitForBadge } from './helpers/vault-helpers.js';

const PORT = 8088;
const TEST_USER     = 'e2e-user';
const TEST_PASS     = 'e2e-password-123';
const TOKEN_VALUE   = 'demo-value-12345';
const USERNAME_VALUE = 'alice';

let ctx, extId, server, profileDir;

test.beforeAll(async () => {
  server = await startServer(PORT);
  ({ context: ctx, extId, userDataDir: profileDir } = await launchWithExtension());
});

test.afterAll(async () => {
  await ctx.close();
  server.close();
  cleanupProfile(profileDir);
});

// ─────────────────────────────────────────────────────────────────────────────

test('vault can be created and secrets stored', async () => {
  const vault = await ctx.newPage();
  await vault.goto(`chrome-extension://${extId}/vault.html`);

  await createVaultAndAddSecrets(vault, {
    username: TEST_USER,
    password: TEST_PASS,
    secrets: [
      { name: 'DEMO_TOKEN',    domain: 'localhost', value: TOKEN_VALUE    },
      { name: 'DEMO_USERNAME', domain: 'localhost', value: USERNAME_VALUE },
    ],
  });

  // Both secrets appear in the sidebar
  await expect(vault.locator('.s-name').filter({ hasText: 'DEMO_TOKEN' })).toBeVisible();
  await expect(vault.locator('.s-name').filter({ hasText: 'DEMO_USERNAME' })).toBeVisible();
});

test('secret references are NOT visible in DOM before submit', async () => {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/tests/smoke-test.html`);

  // Fields should contain the reference tokens, not real values
  await expect(page.locator('input[name=token]')).toHaveValue('{{DEMO_TOKEN}}');
  await expect(page.locator('input[name=username]')).toHaveValue('{{DEMO_USERNAME}}');

  // Output panel must not be visible before submit
  await expect(page.locator('#out')).toBeHidden();
});

test('form submit resolves references and injects real values', async () => {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/tests/smoke-test.html`);

  await page.click('button[type=submit]');

  // Badge flashes success
  await waitForBadge(page, 'ok', 15_000);
  expect(await page.getAttribute('enigmagent-badge', 'data-text'))
    .toContain('submitted with real values');

  // Output panel shows real values
  const out = await page.locator('#out').textContent();
  expect(out).toContain(`"token": "${TOKEN_VALUE}"`);
  expect(out).toContain(`"username": "${USERNAME_VALUE}"`);

  // Reference tokens must NOT appear in output
  expect(out).not.toContain('DEMO_TOKEN');
  expect(out).not.toContain('DEMO_USERNAME');
});

test('console never logs the real secret value', async () => {
  const page = await ctx.newPage();
  const loggedValues = [];
  page.on('console', msg => loggedValues.push(msg.text()));

  await page.goto(`http://localhost:${PORT}/tests/smoke-test.html`);
  await page.click('button[type=submit]');
  await waitForBadge(page, 'ok', 15_000);

  for (const line of loggedValues) {
    expect(line).not.toContain(TOKEN_VALUE);
    expect(line).not.toContain(USERNAME_VALUE);
  }
});
