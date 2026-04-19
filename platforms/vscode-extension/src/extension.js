/**
 * EnigmAgent — VS Code / Cursor / Windsurf extension
 *
 * Provides:
 *  • A sidebar vault panel (WebviewPanel backed by vault-pwa.js)
 *  • enigmagent.resolveSelection — resolves {{PLACEHOLDER}} in selected text
 *  • enigmagent.copySecret — picks a secret and copies it to clipboard
 *  • enigmagent.openVault / lockVault commands
 *
 * The vault runs entirely inside the VS Code webview (same origin isolation
 * as the browser extension — no plain-text values in extension host memory).
 * Communication between webview ↔ extension host uses VS Code's postMessage
 * API with a custom protocol mirroring the browser extension's bridge.
 */

'use strict';

const vscode = require('vscode');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');

// Extension-scoped state
let vaultPanel = null;
let statusBarItem = null;

/**
 * Called when the extension is activated.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'enigmagent.openVault';
  statusBarItem.text    = '$(lock) EnigmAgent';
  statusBarItem.tooltip = 'EnigmAgent Vault — click to open';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('enigmagent.openVault', () => openVaultPanel(context)),
    vscode.commands.registerCommand('enigmagent.lockVault', lockVault),
    vscode.commands.registerCommand('enigmagent.resolveSelection', () => resolveSelection(context)),
    vscode.commands.registerCommand('enigmagent.copySecret', () => copySecretToClipboard(context)),
  );

  // Register webview provider for sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('enigmagentVault', {
      resolveWebviewView(webviewView) {
        setupWebview(webviewView.webview, context);
        webviewView.webview.onDidReceiveMessage(msg => handleWebviewMessage(msg, webviewView.webview));
      }
    }, { webviewOptions: { retainContextWhenHidden: true } })
  );
}

function deactivate() {
  statusBarItem?.dispose();
  vaultPanel?.dispose();
}

// ── Vault panel ───────────────────────────────────────────────────────────────

function openVaultPanel(context) {
  if (vaultPanel) { vaultPanel.reveal(); return; }

  vaultPanel = vscode.window.createWebviewPanel(
    'enigmagentVault',
    'EnigmAgent Vault',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media')),
      ],
    }
  );

  setupWebview(vaultPanel.webview, context);
  vaultPanel.webview.onDidReceiveMessage(msg => handleWebviewMessage(msg, vaultPanel.webview));
  vaultPanel.onDidDispose(() => { vaultPanel = null; });
}

function setupWebview(webview, context) {
  webview.options = { enableScripts: true };
  webview.html = getWebviewHtml(webview, context);
}

function lockVault() {
  const webview = vaultPanel?.webview;
  if (webview) webview.postMessage({ type: 'lock' });
  statusBarItem.text = '$(lock) EnigmAgent';
}

// ── Webview ↔ Extension message bridge ───────────────────────────────────���───

function handleWebviewMessage(msg, webview) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'vault-unlocked':
      statusBarItem.text = '$(unlock) EnigmAgent';
      break;
    case 'vault-locked':
      statusBarItem.text = '$(lock) EnigmAgent';
      break;
    case 'resolve-request': {
      // The webview asks extension host to resolve a placeholder
      // (Extension host has no vault access — redirect back to webview)
      webview.postMessage({ type: 'resolve-response', id: msg.id, placeholder: msg.placeholder });
      break;
    }
    case 'copy-to-clipboard':
      vscode.env.clipboard.writeText(msg.value).then(() => {
        vscode.window.showInformationMessage(`EnigmAgent: "${msg.name}" copied to clipboard.`);
      });
      break;
    case 'error':
      vscode.window.showErrorMessage(`EnigmAgent: ${msg.message}`);
      break;
  }
}

// ── Editor commands ───────────────────────────────────────────────────────────

async function resolveSelection(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('EnigmAgent: select a {{PLACEHOLDER}} first.');
    return;
  }
  // Open vault panel and request resolution
  openVaultPanel(context);
  // The webview handles the resolution internally — we pass the selection
  setTimeout(() => {
    vaultPanel?.webview.postMessage({ type: 'resolve-editor-selection', text: selection });
  }, 500);
}

async function copySecretToClipboard(context) {
  openVaultPanel(context);
  setTimeout(() => {
    vaultPanel?.webview.postMessage({ type: 'trigger-copy-picker' });
  }, 500);
}

// ── Webview HTML ──────────────────────────────────────────────────────────────

function getWebviewHtml(webview, context) {
  const mediaPath = path.join(context.extensionPath, 'media');
  const asUri = (rel) => webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, rel)));

  const argon2Uri = asUri('argon2id.js');
  const styleUri  = asUri('style.css');
  const vaultUri  = asUri('vault-vscode.js');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src  ${webview.cspSource} 'unsafe-inline';
    style-src   ${webview.cspSource} 'unsafe-inline';
    font-src    ${webview.cspSource};
    img-src     ${webview.cspSource} data:;
  ">
  <title>EnigmAgent Vault</title>
  <link rel="stylesheet" href="${styleUri}">
  <style>
    /* Compact layout for sidebar / panel */
    body { font-size: 12px; }
    .topbar { padding: 8px 12px; }
    .tagline { display: none; }
    #app { min-height: auto; }
    .card { padding: 16px; }
    .sidebar { min-width: 140px; }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="logo">🔒</span>
      <span class="title">EnigmAgent</span>
    </div>
    <div class="status" id="status">locked</div>
  </header>
  <main id="app">
    <section id="view-auth" class="view active">
      <div class="card">
        <h1>Unlock vault</h1>
        <label>Username <input id="auth-user" type="text" autocomplete="username"></label>
        <label>Password <input id="auth-pass" type="password" autocomplete="current-password"></label>
        <div class="row">
          <button id="btn-unlock" class="primary">Unlock</button>
          <button id="btn-create" class="secondary">New</button>
        </div>
        <details class="import">
          <summary>Import vault file</summary>
          <input id="vault-file" type="file" accept=".json,.vault">
        </details>
        <p id="auth-msg" hidden></p>
        <p id="auth-progress" class="progress" hidden>Deriving key…</p>
      </div>
    </section>
    <section id="view-vault" class="view">
      <aside class="sidebar">
        <div class="sidebar-head">
          <h2>Secrets</h2>
          <button id="btn-add" class="small">+ new</button>
        </div>
        <ul id="secret-list" class="secret-list"></ul>
        <div class="sidebar-foot">
          <button id="btn-export" class="small">Export</button>
          <button id="btn-lock" class="small danger">Lock</button>
        </div>
      </aside>
      <section class="chat">
        <div id="chat-log" class="chat-log">
          <div class="msg sys">
            <p><strong>Vault unlocked.</strong> Type <code>help</code> for commands.</p>
          </div>
        </div>
        <form id="chat-form" class="chat-form">
          <textarea id="chat-input" rows="2" placeholder="add NAME @domain VALUE"></textarea>
          <div class="chat-actions">
            <label class="file-btn">📎<input id="doc-upload" type="file" accept=".md,.txt" hidden></label>
            <button type="submit" class="primary">Send</button>
          </div>
        </form>
      </section>
    </section>
    <div id="modal" class="modal" hidden>
      <div class="modal-card">
        <h3 id="modal-title">New secret</h3>
        <label>Name <input id="m-name" placeholder="API_KEY"></label>
        <label>Domain <input id="m-domain" placeholder="example.com"></label>
        <label>Value <textarea id="m-value" rows="3" placeholder="enter the secret value"></textarea></label>
        <div class="row">
          <button id="m-save" class="primary">Save</button>
          <button id="m-copy" class="secondary">Copy</button>
          <button id="m-cancel" class="secondary">Cancel</button>
        </div>
      </div>
    </div>
  </main>
  <footer class="footer">
    <span>EnigmAgent v0.2 · VS Code</span>
  </footer>
  <script src="${argon2Uri}"></script>
  <script src="${vaultUri}"></script>
</body>
</html>`;
}

module.exports = { activate, deactivate };
