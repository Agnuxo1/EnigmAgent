/**
 * EnigmAgent E2E — browser launch helper.
 *
 * Launches a persistent Chromium context with the extension loaded from
 * ../../extension/. Each call gets a fresh temp profile so test runs don't
 * share vault state.
 */

import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir }              from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath }       from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const EXTENSION_PATH = resolve(__dir, '../../../extension');

/**
 * @returns {{ context: import('@playwright/test').BrowserContext,
 *             extId: string,
 *             userDataDir: string }}
 */
export async function launchWithExtension() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'enigmagent-e2e-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  // Grab the service worker to extract the extension ID.
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 20_000 });
  }
  const extId = new URL(sw.url()).hostname;

  return { context, extId, userDataDir };
}

/** Clean up a temp profile directory after tests. */
export function cleanupProfile(userDataDir) {
  try { rmSync(userDataDir, { recursive: true, force: true }); } catch {}
}
