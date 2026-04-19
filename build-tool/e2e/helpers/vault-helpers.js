/**
 * EnigmAgent E2E — vault page helpers.
 *
 * High-level actions on vault.html, used by all spec files.
 */

import { expect } from '@playwright/test';

/**
 * Create a brand-new vault and add secrets via the chat interface.
 *
 * @param {import('@playwright/test').Page} page — must already be on vault.html
 * @param {{ username: string, password: string,
 *           secrets: Array<{name:string, domain?:string, value:string}> }} opts
 */
export async function createVaultAndAddSecrets(page, { username, password, secrets = [] }) {
  // Wait for auth view to be active
  await page.waitForSelector('#view-auth.active', { timeout: 10_000 });

  await page.fill('#auth-user', username);
  await page.fill('#auth-pass', password);
  await page.click('#btn-create');

  // Argon2id derivation — allow up to 30s (m=64 MiB, t=3)
  await page.waitForSelector('#view-vault.active', { timeout: 30_000 });

  for (const s of secrets) {
    const cmd = s.domain
      ? `add ${s.name} @${s.domain} ${s.value}`
      : `add ${s.name} ${s.value}`;
    await page.fill('#chat-input', cmd);
    await page.keyboard.press('Enter');
    // Each successful add prints "Stored NAME bound to …" in the chat log
    await expect(page.locator(`.msg.out`).last()).toContainText(`Stored ${s.name}`, { timeout: 5_000 });
  }
}

/**
 * Unlock an existing vault.
 */
export async function unlockVault(page, { username, password }) {
  await page.waitForSelector('#view-auth.active', { timeout: 10_000 });
  await page.fill('#auth-user', username);
  await page.fill('#auth-pass', password);
  await page.click('#btn-unlock');
  await page.waitForSelector('#view-vault.active', { timeout: 30_000 });
}

/**
 * Wait for the EnigmAgent badge to reach a given state.
 * The host element (<enigmagent-badge>) is in the regular DOM and exposes
 * data-state / data-text for testability (Shadow DOM content is closed).
 *
 * @param {import('@playwright/test').Page} page
 * @param {'ok'|'error'|'pending'|'hidden'} state
 * @param {number} [timeout=15000]
 */
export async function waitForBadge(page, state, timeout = 15_000) {
  await page.waitForSelector(`enigmagent-badge[data-state="${state}"]`, { timeout });
}

/**
 * Read badge text from the data-text attribute (no shadow root access needed).
 */
export async function getBadgeText(page) {
  return page.getAttribute('enigmagent-badge', 'data-text');
}
