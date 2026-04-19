/*
 * EnigmAgent Bridge — content script.
 *
 * Injected into every page. Watches for form submissions and input blur events;
 * when it finds {{PLACEHOLDER}} tokens in form values, it asks the background
 * service worker to resolve them via the vault tab, then swaps the real value
 * into the input just before the form is actually submitted.
 *
 * The real value lives in a JS variable for ~1 event-loop tick, is written
 * directly into the input's value property (not the clipboard), and the form
 * is then re-submitted programmatically.
 */

'use strict';

const PLACEHOLDER_RE = /\{\{([A-Z0-9_:\-.@]+)\}\}/g;
const BADGE_ID = '__enigmagent_badge__';

// ---------- badge ----------

function ensureBadge(state) {
  let el = document.getElementById(BADGE_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = BADGE_ID;
    el.style.cssText = [
      'position:fixed', 'bottom:12px', 'right:12px', 'z-index:2147483647',
      'background:#171a21', 'color:#e7e9ee', 'font:12px/1.4 -apple-system,Segoe UI,sans-serif',
      'padding:6px 10px', 'border:1px solid #2a2f3a', 'border-radius:999px',
      'box-shadow:0 2px 8px rgba(0,0,0,.35)', 'pointer-events:none',
      'opacity:0', 'transition:opacity .25s',
    ].join(';');
    document.documentElement.appendChild(el);
  }
  el.textContent = state.text;
  el.style.opacity = state.visible ? '1' : '0';
  el.style.color = state.error ? '#f06464' : '#e7e9ee';
  if (state.autoHide) setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

// ---------- submit interception ----------

document.addEventListener('submit', onSubmit, true);
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t && (t.matches?.('button[type=submit], input[type=submit]') ||
            (t.closest && t.closest('button[type=submit], input[type=submit]')))) {
    const form = t.closest('form');
    if (form && formHasPlaceholders(form)) {
      // Let the default submit flow fire onSubmit below.
    }
  }
}, true);

function formHasPlaceholders(form) {
  for (const el of form.querySelectorAll('input, textarea')) {
    if (typeof el.value === 'string' && PLACEHOLDER_RE.test(el.value)) {
      PLACEHOLDER_RE.lastIndex = 0;
      return true;
    }
    PLACEHOLDER_RE.lastIndex = 0;
  }
  return false;
}

async function onSubmit(e) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.enigmaDone === '1') return; // already resolved, let it through

  const fields = [...form.querySelectorAll('input, textarea')]
    .filter(el => typeof el.value === 'string' && hasPlaceholder(el.value));
  if (fields.length === 0) return;

  e.preventDefault();
  e.stopPropagation();

  ensureBadge({ text: '🔓 resolving placeholders…', visible: true });

  try {
    for (const el of fields) {
      const resolved = await resolveValue(el.value);
      setInputValue(el, resolved);
    }
    form.dataset.enigmaDone = '1';
    ensureBadge({ text: '✓ submitted with real values', visible: true, autoHide: true });
    // Re-submit. Use requestSubmit to respect validation and submitter buttons.
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.submit();
  } catch (err) {
    ensureBadge({ text: `⚠ ${err.message}`, visible: true, error: true, autoHide: true });
  }
}

function hasPlaceholder(s) {
  PLACEHOLDER_RE.lastIndex = 0;
  const r = PLACEHOLDER_RE.test(s);
  PLACEHOLDER_RE.lastIndex = 0;
  return r;
}

async function resolveValue(template) {
  const matches = [...template.matchAll(PLACEHOLDER_RE)];
  let out = template;
  for (const m of matches) {
    const placeholder = m[1];
    const reply = await chrome.runtime.sendMessage({
      type: 'resolve-placeholder',
      placeholder,
      origin: location.origin,
    });
    if (reply?.error) {
      throw new Error(`${placeholder}: ${reply.error}`);
    }
    if (typeof reply?.value !== 'string') {
      throw new Error(`${placeholder}: empty response`);
    }
    out = out.split(m[0]).join(reply.value);
  }
  return out;
}

function setInputValue(el, value) {
  // Use the native setter so frameworks (React, Vue) notice the change.
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------- first-paint hint ----------

// On pages where the agent is likely to work (any form with a password or token field),
// nudge the user with a non-blocking badge showing current vault status.
window.addEventListener('load', async () => {
  const hasSensitiveField = !!document.querySelector(
    'input[type=password], input[name*=token i], input[name*=secret i], input[name*=api i]'
  );
  if (!hasSensitiveField) return;
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  ensureBadge({
    text: status?.vaultTabId ? '🔓 EnigmAgent ready' : '🔒 EnigmAgent · open vault to enable',
    visible: true, autoHide: true,
  });
});
