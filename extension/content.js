/*
 * EnigmAgent — content script.
 *
 * Watches every form submit on every page. When it finds a {{PLACEHOLDER}} in
 * any input/textarea value, it pauses the submit, asks the service worker to
 * resolve the placeholder against the unlocked vault (checking domain binding),
 * writes the real value directly into the DOM field via the native property
 * setter (so React/Vue notice), then re-submits the form exactly once.
 *
 * The real value is in JS memory for roughly one event-loop tick. It is never
 * written to the clipboard, to console, or to any logging channel.
 */

'use strict';

const PLACEHOLDER_RE = /\{\{([A-Z0-9_:\-.@]+)\}\}/g;
const BADGE_ID = '__enigmagent_badge__';
const DONE_FLAG = 'enigmaDone';

// ---------- badge ----------

function showBadge(state) {
  let el = document.getElementById(BADGE_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = BADGE_ID;
    el.style.cssText = [
      'position:fixed', 'bottom:12px', 'right:12px', 'z-index:2147483647',
      'background:#171a21', 'color:#e7e9ee',
      'font:12px/1.4 -apple-system,Segoe UI,sans-serif',
      'padding:6px 10px', 'border:1px solid #2a2f3a', 'border-radius:999px',
      'box-shadow:0 2px 8px rgba(0,0,0,.35)', 'pointer-events:none',
      'opacity:0', 'transition:opacity .25s',
    ].join(';');
    (document.documentElement || document.body).appendChild(el);
  }
  el.textContent = state.text;
  el.style.opacity = state.visible ? '1' : '0';
  el.style.color = state.error ? '#f06464' : (state.ok ? '#7bd389' : '#e7e9ee');
  if (state.autoHide) setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

// ---------- submit interception ----------

document.addEventListener('submit', onSubmit, { capture: true });

function hasPlaceholder(s) {
  if (typeof s !== 'string') return false;
  PLACEHOLDER_RE.lastIndex = 0;
  const r = PLACEHOLDER_RE.test(s);
  PLACEHOLDER_RE.lastIndex = 0;
  return r;
}

async function onSubmit(e) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset[DONE_FLAG] === '1') return;

  const fields = [...form.querySelectorAll('input, textarea')]
    .filter(el => hasPlaceholder(el.value));
  if (fields.length === 0) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  showBadge({ text: '🔓 resolving placeholders…', visible: true });

  try {
    for (const el of fields) {
      const resolved = await resolveValue(el.value);
      setInputValue(el, resolved);
    }
    form.dataset[DONE_FLAG] = '1';
    showBadge({ text: '✓ submitted with real values', visible: true, ok: true, autoHide: true });
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.submit();
  } catch (err) {
    showBadge({ text: '⚠ ' + (err.message || String(err)), visible: true, error: true, autoHide: true });
  }
}

async function resolveValue(template) {
  const matches = [...template.matchAll(PLACEHOLDER_RE)];
  let out = template;
  for (const m of matches) {
    const reply = await chrome.runtime.sendMessage({
      type: 'resolve-placeholder',
      placeholder: m[1],
      origin: location.origin,
    });
    if (reply?.error) {
      let msg = `${m[1]}: ${reply.error}`;
      if (reply.error === 'domain_mismatch' && reply.expected) {
        msg = `${m[1]}: bound to ${reply.expected}, refused on ${location.hostname}`;
      }
      if (reply.error === 'vault_not_open') msg = 'vault not open — click the EnigmAgent icon';
      if (reply.error === 'vault_locked') msg = 'vault is locked — open the vault tab and unlock';
      if (reply.error === 'no_domain_binding') msg = `${m[1]}: needs a domain binding, refused`;
      throw new Error(msg);
    }
    if (typeof reply?.value !== 'string') {
      throw new Error(`${m[1]}: empty response`);
    }
    out = out.split(m[0]).join(reply.value);
  }
  return out;
}

function setInputValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------- first-paint hint on sensitive pages ----------

window.addEventListener('load', async () => {
  const sensitive = document.querySelector(
    'input[type=password], input[name*=token i], input[name*=secret i], ' +
    'input[name*=api i], input[autocomplete*=password i]'
  );
  if (!sensitive) return;
  try {
    const status = await chrome.runtime.sendMessage({ type: 'status' });
    showBadge({
      text: status?.vaultTabId ? '🔓 EnigmAgent ready' : '🔒 EnigmAgent · click icon to unlock',
      visible: true, ok: !!status?.vaultTabId, autoHide: true,
    });
  } catch { /* extension context missing, ignore */ }
});
