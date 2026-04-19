/**
 * NanoClaw channel registry.
 *
 * Add channels here to make them available to NanoClaw agents.
 * Import and call registerChannel(channel) for each integration.
 */

import type { Channel } from './types';
import { enigmagentChannel } from './channels/enigmagent';

const _registry = new Map<string, Channel>();

export function registerChannel(channel: Channel): void {
  if (_registry.has(channel.name)) {
    console.warn(`[NanoClaw] Channel '${channel.name}' is already registered. Overwriting.`);
  }
  _registry.set(channel.name, channel);
}

export function getChannel(name: string): Channel | undefined {
  return _registry.get(name);
}

export function listChannels(): Channel[] {
  return [..._registry.values()];
}

// ── Register built-in channels ──────────────────────────────────────────────
registerChannel(enigmagentChannel);
