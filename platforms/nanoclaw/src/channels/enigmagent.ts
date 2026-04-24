/**
 * enigmagent — NanoClaw channel integration.
 *
 * Registers EnigmAgent vault capabilities as a NanoClaw channel so that
 * any NanoClaw agent workflow can check vault status, list secrets, and
 * resolve {{PLACEHOLDER}} references.
 *
 * Registration (in registry.ts):
 *   import { enigmagentChannel } from './channels/enigmagent';
 *   registerChannel(enigmagentChannel);
 *
 * Compatible with NanoClaw >= 1.0.0
 */

import type { Channel, ChannelContext, ChannelMessage, ChannelResponse } from '../types';

// ---------------------------------------------------------------------------
// Vault HTTP helpers (stdlib fetch — no extra deps)
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_:\-.@]+)\}\}/g;

interface VaultStatusResponse {
  status: string;
  unlocked: boolean;
}

interface VaultListResponse {
  entries: Array<{ id: string; name: string; domain?: string; created: string }>;
}

interface VaultResolveResponse {
  value: string;
}

function vaultBase(ctx: ChannelContext): string {
  const host = ctx.config?.enigmagent?.host ?? '127.0.0.1';
  const port = ctx.config?.enigmagent?.port ?? 3737;
  return `http://${host}:${port}`;
}

async function vaultGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(`EnigmAgent vault error (${body.error ?? res.status}): ${body.message ?? res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function vaultPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(`EnigmAgent vault error (${err.error ?? res.status}): ${err.message ?? res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Channel handlers
// ---------------------------------------------------------------------------

async function handleStatus(ctx: ChannelContext): Promise<ChannelResponse> {
  const base = vaultBase(ctx);
  try {
    const data = await vaultGet<VaultStatusResponse>(`${base}/status`);
    return {
      type: 'success',
      data: {
        running:  true,
        unlocked: data.unlocked,
        message:  data.unlocked
          ? 'EnigmAgent vault is RUNNING and UNLOCKED.'
          : 'Vault is LOCKED — restart enigmagent-mcp.',
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      type: 'error',
      data: { running: false, unlocked: false, error: msg },
    };
  }
}

async function handleList(ctx: ChannelContext): Promise<ChannelResponse> {
  const base = vaultBase(ctx);
  try {
    const data = await vaultGet<VaultListResponse>(`${base}/list`);
    const entries = data.entries.map((e) => ({ name: e.name, domain: e.domain ?? null }));
    return {
      type: 'success',
      data: { count: entries.length, entries },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'error', data: { error: msg } };
  }
}

async function handleResolve(
  ctx: ChannelContext,
  msg: ChannelMessage,
): Promise<ChannelResponse> {
  const base        = vaultBase(ctx);
  const placeholder = (msg.payload?.placeholder as string | undefined) ?? '';
  const origin      = (msg.payload?.origin as string | undefined) ?? 'http://localhost';

  if (!placeholder) {
    return { type: 'error', data: { error: 'Missing required field: placeholder' } };
  }

  try {
    const data = await vaultPost<VaultResolveResponse>(`${base}/resolve`, { placeholder, origin });
    return { type: 'success', data: { placeholder, value: data.value } };
  } catch (err: unknown) {
    const msg2 = err instanceof Error ? err.message : String(err);
    return { type: 'error', data: { error: msg2 } };
  }
}

async function handleResolveText(
  ctx: ChannelContext,
  msg: ChannelMessage,
): Promise<ChannelResponse> {
  const base      = vaultBase(ctx);
  const inputText = (msg.payload?.text as string | undefined) ?? '';
  const origin    = (msg.payload?.origin as string | undefined) ?? 'http://localhost';

  if (!inputText) {
    return { type: 'error', data: { error: 'Missing required field: text' } };
  }

  const names = [...new Set([...inputText.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
  if (names.length === 0) {
    return { type: 'success', data: { original: inputText, resolved: inputText, replaced: 0 } };
  }

  // Resolve all in parallel
  const results = await Promise.allSettled(
    names.map((name) =>
      vaultPost<VaultResolveResponse>(`${base}/resolve`, { placeholder: name, origin }).then(
        (r) => ({ name, value: r.value }),
      ),
    ),
  );

  let resolvedText = inputText;
  let replaced = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { name, value } = result.value;
      resolvedText = resolvedText.replace(
        new RegExp(`\\{\\{${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g'),
        value,
      );
      replaced++;
    }
  }

  return {
    type: 'success',
    data: { original: inputText, resolved: resolvedText, replaced },
  };
}

// ---------------------------------------------------------------------------
// Channel definition
// ---------------------------------------------------------------------------

export const enigmagentChannel: Channel = {
  name:        'enigmagent',
  version:     '1.0.0',
  description: 'EnigmAgent local vault — check status, list secrets, resolve {{PLACEHOLDER}} references.',

  /**
   * Incoming message format:
   *   { action: 'status' | 'list' | 'resolve' | 'resolveText', payload?: {...} }
   */
  async handle(msg: ChannelMessage, ctx: ChannelContext): Promise<ChannelResponse> {
    const action = msg.action as string;

    switch (action) {
      case 'status':
        return handleStatus(ctx);
      case 'list':
        return handleList(ctx);
      case 'resolve':
        return handleResolve(ctx, msg);
      case 'resolveText':
        return handleResolveText(ctx, msg);
      default:
        return {
          type: 'error',
          data: {
            error:   'UNKNOWN_ACTION',
            message: `Unknown enigmagent action: ${action}. Supported: status, list, resolve, resolveText`,
          },
        };
    }
  },

  tools: [
    {
      name:        'enigmagent_vault_status',
      description: 'Check whether the EnigmAgent vault server is running and the vault is unlocked.',
      inputSchema: { type: 'object', properties: {}, required: [] },
      async call(_params: unknown, ctx: ChannelContext) {
        const r = await handleStatus(ctx);
        return r.data;
      },
    },
    {
      name:        'enigmagent_vault_list',
      description: 'List all secrets in the EnigmAgent vault by name and domain. Never returns values.',
      inputSchema: { type: 'object', properties: {}, required: [] },
      async call(_params: unknown, ctx: ChannelContext) {
        const r = await handleList(ctx);
        return r.data;
      },
    },
    {
      name:        'enigmagent_resolve',
      description: 'Resolve a single {{PLACEHOLDER}} name to its real value.',
      inputSchema: {
        type:       'object',
        properties: {
          placeholder: { type: 'string', description: 'Secret name without braces, e.g. GITHUB_TOKEN' },
          origin:      { type: 'string', description: 'Origin for domain binding', default: 'http://localhost' },
        },
        required: ['placeholder'],
      },
      async call(params: unknown, ctx: ChannelContext) {
        const r = await handleResolve(ctx, { action: 'resolve', payload: params as Record<string, unknown> });
        return r.data;
      },
    },
    {
      name:        'enigmagent_resolve_text',
      description: 'Replace all {{PLACEHOLDER}} references in a text block with their real values.',
      inputSchema: {
        type:       'object',
        properties: {
          text:   { type: 'string', description: 'Text containing {{PLACEHOLDER}} references' },
          origin: { type: 'string', description: 'Origin for domain binding', default: 'http://localhost' },
        },
        required: ['text'],
      },
      async call(params: unknown, ctx: ChannelContext) {
        const r = await handleResolveText(ctx, { action: 'resolveText', payload: params as Record<string, unknown> });
        return r.data;
      },
    },
  ],
};
