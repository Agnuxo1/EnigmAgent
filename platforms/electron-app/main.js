/**
 * EnigmAgent — Electron desktop app
 *
 * Creates a native desktop window loading the vault PWA.
 * The vault file lives in app.getPath('userData')/vault.json.
 * Electron's contextIsolation + nodeIntegration=false ensures
 * the renderer has the same security model as the browser.
 *
 * Setup:
 *   npm install
 *   npm start                     # development
 *   npm run dist                  # production package (Windows/macOS/Linux)
 */

'use strict';

const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path  = require('path');
const fs    = require('fs');
const http  = require('http');
const https = require('https');

// ── Constants ─────────────────────────────────────────────────────────────────
const VAULT_DIR  = app.getPath('userData');
const VAULT_FILE = path.join(VAULT_DIR, 'vault.json');
const PWA_PORT   = 57370 + Math.floor(Math.random() * 100); // random to avoid conflicts
const DEV_MODE   = process.env.NODE_ENV === 'development';

let mainWindow = null;
let tray       = null;
let pwaServer  = null;

// ── Static server (serves PWA from app resources) ────────────────────────────

function startServer() {
  const { createServer } = require('http');
  const { readFile }     = require('fs/promises');
  const { extname, join } = require('path');

  const PWA_DIR = path.join(__dirname, 'pwa');
  const MIME = {
    '.html':  'text/html; charset=utf-8',
    '.js':    'application/javascript',
    '.css':   'text/css',
    '.json':  'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png':   'image/png',
  };

  pwaServer = createServer(async (req, res) => {
    const pathname = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = join(PWA_DIR, pathname);
    try {
      const data = await readFile(filePath);
      const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Not Found');
    }
  });

  return new Promise((resolve) => pwaServer.listen(PWA_PORT, '127.0.0.1', resolve));
}

// ── Window ────────────────────────────────────────────────────────────────────

async function createWindow() {
  await startServer();

  mainWindow = new BrowserWindow({
    width:           900,
    height:          700,
    minWidth:        640,
    minHeight:       480,
    title:           'EnigmAgent Vault',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#ffffff',
    webPreferences: {
      // Security: no Node.js in renderer
      nodeIntegration:      false,
      contextIsolation:     true,
      sandbox:              true,
      webSecurity:          true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PWA_PORT}/`);

  if (DEV_MODE) mainWindow.webContents.openDevTools();

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin') { e.preventDefault(); mainWindow.hide(); }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── System tray ───────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, 'resources', 'icon-16.png');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip('EnigmAgent Vault');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Vault',    click: () => { mainWindow?.show() ?? createWindow(); } },
    { type: 'separator' },
    { label: 'Quit',          click: () => { app.quit(); } },
  ]));
  tray.on('click', () => mainWindow?.show() ?? createWindow());
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('get-vault-path', () => VAULT_FILE);

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    pwaServer?.close();
    app.quit();
  }
});

app.on('before-quit', () => { pwaServer?.close(); });

// ── Application menu ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'EnigmAgent',
      submenu: [
        { label: 'About EnigmAgent', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'GitHub', click: () => shell.openExternal('https://github.com/agnuxo1/EnigmAgent') },
      ],
    },
  ]));
});
