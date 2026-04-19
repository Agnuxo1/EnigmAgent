/**
 * EnigmAgent Electron — preload script.
 * Runs in renderer context with contextIsolation=true.
 * Exposes only the minimal bridge needed for file operations.
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('enigmagentBridge', {
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),
});
