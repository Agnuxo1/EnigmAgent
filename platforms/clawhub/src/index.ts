/**
 * clawhub-skill-enigmagent — ClawHub skill entry point.
 *
 * Exports the four EnigmAgent vault tools for ClawHub skill runners.
 */

const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_:\-.@]+)\}\}/g;

function vaultBase(config: Record<string, unknown>): string {
  const host = (config['enigmagent.host'] as string | undefined) ?? '127.0.0.1';
  const port = (config['enigmagent.port'] as number | undefined) ?? 3737;
  return `http://${host}:${port}`;
}

async function vaultGet(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(`Vault error (${body.error ?? res.status}): ${body.message ?? res.statusText}`);
  }
  return res.json();
}

async function vaultPost(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(`Vault error (${err.error ?? res.status}): ${err.message ?? res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

export async function enigmagent_vault_status(
  _params: Record<string, never>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const base = vaultBase(config);
  try {
    const data = await vaultGet(`${base}/status`) as { unlocked: boolean };
    return {
      running:  true,
      unlocked: data.unlocked,
      message:  data.unlocked
        ? 'Vault RUNNING and UNLOCKED.'
        : 'Vault LOCKED — restart enigmagent-mcp.',
    };
  } catch (err: unknown) {
    return { running: false, unlocked: false, error: String(err) };
  }
}

export async function enigmagent_vault_list(
  _params: Record<string, never>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const base = vaultBase(config);
  try {
    const data = await vaultGet(`${base}/list`) as {
      entries: Array<{ name: string; domain?: string }>;
    };
    const entries = data.entries.map((e) => ({ name: e.name, domain: e.domain ?? null }));
    return { count: entries.length, entries };
  } catch (err: unknown) {
    return { error: String(err) };
  }
}

export async function enigmagent_resolve(
  params: { placeholder: string; origin?: string },
  config: Record<string, unknown>,
): Promise<unknown> {
  const base   = vaultBase(config);
  const origin = params.origin ?? (config['enigmagent.origin'] as string | undefined) ?? 'http://localhost';
  try {
    const data = await vaultPost(`${base}/resolve`, {
      placeholder: params.placeholder,
      origin,
    }) as { value: string };
    return { placeholder: params.placeholder, value: data.value };
  } catch (err: unknown) {
    return { error: String(err) };
  }
}

export async function enigmagent_resolve_text(
  params: { text: string; origin?: string },
  config: Record<string, unknown>,
): Promise<unknown> {
  const base      = vaultBase(config);
  const origin    = params.origin ?? (config['enigmagent.origin'] as string | undefined) ?? 'http://localhost';
  const inputText = params.text;

  const names = [...new Set([...inputText.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
  if (names.length === 0) {
    return { original: inputText, resolved: inputText, replaced: 0 };
  }

  const results = await Promise.allSettled(
    names.map((name) =>
      vaultPost(`${base}/resolve`, { placeholder: name, origin }).then(
        (r) => ({ name, value: (r as { value: string }).value }),
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

  return { original: inputText, resolved: resolvedText, replaced };
}

// ---------------------------------------------------------------------------
// Skill manifest (used by ClawHub runner)
// ---------------------------------------------------------------------------

export const skill = {
  name:    'enigmagent-vault',
  version: '1.0.0',
  tools: {
    enigmagent_vault_status,
    enigmagent_vault_list,
    enigmagent_resolve,
    enigmagent_resolve_text,
  },
};

export default skill;
