/**
 * EnigmAgent E2E — 03: Extended reference syntax
 *
 * Tests:
 *  1. {{LOGIN:domain}} resolves first secret bound to that domain
 *  2. {{DOC:filename}} resolves a stored document
 *  3. Multiple references in one field are all resolved
 *  4. Mixed: one valid + one invalid reference → error (no partial reveal)
 */

import { test, expect }                        from '@playwright/test';
import { launchWithExtension, cleanupProfile } from './helpers/launch.js';
import { startServer }                         from './helpers/server.js';
import {
  createVaultAndAddSecrets,
  waitForBadge,
  getBadgeText,
} from './helpers/vault-helpers.js';

const PORT = 8090;

let ctx, extId, server, profileDir, vaultPage;

test.beforeAll(async () => {
  server = await startServer(PORT);
  ({ context: ctx, extId, userDataDir: profileDir } = await launchWithExtension());

  // Keep vault page open so the service worker retains a valid vaultTabId.
  vaultPage = await ctx.newPage();
  await vaultPage.goto(`chrome-extension://${extId}/vault.html`);
  await createVaultAndAddSecrets(vaultPage, {
    username: 'syntax-user',
    password: 'syntax-password-789',
    secrets: [
      // Regular secret — used for LOGIN: test
      { name: 'SITE_KEY',    domain: 'localhost', value: 'resolved-by-domain' },
      // Second secret on same domain — LOGIN: should return SITE_KEY (first added)
      { name: 'SITE_USER',   domain: 'localhost', value: 'alice-by-domain'    },
      // Document secret — name follows DOC_<filename> convention (dots preserved)
      { name: 'DOC_report.md', domain: 'localhost', value: 'This is the report content.' },
    ],
  });
  // Do NOT close vaultPage — the service worker needs it to stay alive.
});

test.afterAll(async () => {
  await ctx.close();   // closes vaultPage too
  server.close();
  cleanupProfile(profileDir);
});

// Helper: open smoke-test, set custom field values, submit, return page
async function submitCustom(ctx, port, { token, username }) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/tests/smoke-test.html`);
  if (token    !== undefined) await page.fill('input[name=token]',    token);
  if (username !== undefined) await page.fill('input[name=username]', username);
  await page.click('button[type=submit]');
  return page;
}

// ─────────────────────────────────────────────────────────────────────────────

test('{{LOGIN:domain}} resolves first secret bound to that domain', async () => {
  const page = await submitCustom(ctx, PORT, {
    token:    '{{LOGIN:localhost}}',
    username: 'plain',
  });

  await waitForBadge(page, 'ok', 15_000);

  const out = await page.locator('#out').textContent();
  // Should contain the value of the first secret on localhost
  expect(out).toContain('"token": "resolved-by-domain"');
  expect(out).not.toContain('LOGIN:localhost');
});

test('{{DOC:report.md}} resolves stored document by filename', async () => {
  const page = await submitCustom(ctx, PORT, {
    token:    '{{DOC:report.md}}',
    username: 'plain',
  });

  await waitForBadge(page, 'ok', 15_000);

  const out = await page.locator('#out').textContent();
  expect(out).toContain('"token": "This is the report content."');
  expect(out).not.toContain('DOC:report.md');
});

test('multiple references in one field are all resolved', async () => {
  // Both {{SITE_KEY}} and {{SITE_USER}} should resolve in a single field value.
  // We put them in separate fields here; a single-field multi-ref test follows.
  const page = await submitCustom(ctx, PORT, {
    token:    '{{SITE_KEY}}',
    username: '{{SITE_USER}}',
  });

  await waitForBadge(page, 'ok', 15_000);

  const out = await page.locator('#out').textContent();
  expect(out).toContain('"token": "resolved-by-domain"');
  expect(out).toContain('"username": "alice-by-domain"');
});

test('one invalid reference in a field aborts the whole submit', async () => {
  // Mixed: valid SITE_KEY + non-existent MISSING — must NOT reveal SITE_KEY
  const page = await submitCustom(ctx, PORT, {
    token:    '{{SITE_KEY}}',
    username: '{{MISSING_SECRET}}',
  });

  await waitForBadge(page, 'error', 15_000);
  const text = await getBadgeText(page);
  expect(text).toMatch(/not_found|MISSING_SECRET/i);

  // The output panel must not have been shown (no partial submission)
  await expect(page.locator('#out')).toBeHidden();
});
