/*
 * EnigmAgent — content script.
 *
 * Watches every form submit on every page. When it finds a {{SECRET_NAME}}
 * reference in any input/textarea value, it pauses the submit, asks the
 * service worker to resolve it against the unlocked vault (checking domain
 * binding), writes the real value via the native property setter (React/Vue
 * compatible), then re-submits the form exactly once.
 *
 * Special reference syntax:
 *   {{MY_TOKEN}}          — resolve by exact secret name
 *   {{LOGIN:github.com}}  — resolve first secret bound to that domain
 *   {{DOC:report.md}}     — resolve a stored document by filename
 *
 * The real value is in JS memory for roughly one event-loop tick. It is never
 * written to the clipboard, to console, or to any logging channel.
 */

'use strict';

// Matches {{NAME}}, {{LOGIN:domain}}, {{DOC:file}} — case-insensitive name part
const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_:\-.@]+)\}\}/g;
const DONE_FLAG = 'enigmaDone';

// ---------- badge — Shadow DOM (fully isolated from host-page CSS) ----------

let _badgeHost = null;
let _badgeEl   = null;

function showBadge(opts) {
  if (!_badgeHost) {
    _badgeHost = document.createElement('enigmagent-badge');
    _badgeHost.style.cssText =
      'position:fixed;bottom:12px;right:12px;z-index:2147483647;pointer-events:none;display:block;';
    const shadow = _badgeHost.attachShadow({ mode: 'closed' });
    _badgeEl = document.createElement('span');
    _badgeEl.style.cssText = [
      'display:inline-block',
      'background:#171a21',
      'color:#e7e9ee',
      'font:12px/1.4 -apple-system,"Segoe UI",sans-serif',
      'padding:6px 12px',
      'border:1px solid #2a2f3a',
      'border-radius:999px',
      'box-shadow:0 2px 8px rgba(0,0,0,.4)',
      'opacity:0',
      'transition:opacity .25s ease',
      'white-space:nowrap',
    ].join(';');
    shadow.appendChild(_badgeEl);
    (document.documentElement || document.body).appendChild(_badgeHost);
  }
  _badgeEl.textContent = opts.text;
  _badgeEl.style.color  = opts.error ? '#f06464' : (opts.ok ? '#7bd389' : '#e7e9ee');
  _badgeEl.style.opacity = opts.visible ? '1' : '0';

  // Expose state on the host element (regular DOM) for automated testing.
  // Shadow DOM content is closed, but data attributes are readable by Playwright.
  _badgeHost.dataset.state = opts.error ? 'error' : (opts.ok ? 'ok' : 'pending');
  _badgeHost.dataset.text  = opts.text || '';

  if (opts.autoHide) setTimeout(() => {
    _badgeEl.style.opacity = '0';
  }, 2600);
}

// ---------- submit interception ----------

document.addEventListener('submit', onSubmit, { capture: true });

function hasReference(s) {
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
    .filter(el => hasReference(el.value));
  if (fields.length === 0) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  showBadge({ text: '🔓 EnigmAgent: resolving secrets…', visible: true });

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
  PLACEHOLDER_RE.lastIndex = 0;
  const matches = [...template.matchAll(PLACEHOLDER_RE)];
  PLACEHOLDER_RE.lastIndex = 0;
  let out = template;
  for (const m of matches) {
    const reply = await chrome.runtime.sendMessage({
      type: 'resolve-placeholder',
      placeholder: m[1],
      origin: location.origin,
    });
    if (reply?.error) {
      let msg = `${m[1]}: ${reply.error}`;
      if (reply.error === 'domain_mismatch' && reply.expected)
        msg = `${m[1]}: bound to ${reply.expected}, refused on ${location.hostname}`;
      if (reply.error === 'vault_not_open')
        msg = 'vault not open — click the EnigmAgent icon';
      if (reply.error === 'vault_locked')
        msg = 'vault is locked — open the vault tab and unlock it';
      if (reply.error === 'no_domain_binding')
        msg = `${m[1]}: no domain binding — add one with: domain ${m[1]} @example.com`;
      throw new Error(msg);
    }
    if (typeof reply?.value !== 'string')
      throw new Error(`${m[1]}: no value returned from vault`);
    out = out.split(m[0]).join(reply.value);
  }
  return out;
}

function setInputValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------- first-paint hint on pages with credential fields ----------

window.addEventListener('load', async () => {
  const sensitive = document.querySelector(
    'input[type=password], input[name*=token i], input[name*=secret i], ' +
    'input[name*=api i], input[autocomplete*=password i]'
  );
  if (!sensitive) return;
  try {
    const status = await chrome.runtime.sendMessage({ type: 'status' });
    showBadge({
      text: status?.vaultTabId ? '🔓 EnigmAgent ready' : '🔒 EnigmAgent · click icon to open vault',
      visible: true, ok: !!status?.vaultTabId, autoHide: true,
    });
  } catch { /* extension context invalidated, ignore */ }
});
