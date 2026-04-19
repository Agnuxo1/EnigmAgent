// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// EnigmAgent Tauri app — Rust backend.
//
// The vault crypto runs in the browser (WebView) using the same
// lib/argon2id.js + Web Crypto stack as the extension and PWA.
// Rust only handles:
//   • Native file I/O (read/write vault JSON)
//   • Tray icon
//   • OS notifications
//
// All crypto lives in JavaScript (WebView) — no vault plaintext
// ever enters Rust process memory.

use tauri::{
    AppHandle, Manager, Runtime,
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};
use std::fs;
use std::path::PathBuf;

// ── File I/O commands ─────────────────────────────────────────────────────────

/// Returns the default vault file path (OS-specific userData dir).
#[tauri::command]
fn vault_path(app: AppHandle) -> String {
    let data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    data_dir.join("vault.json").to_string_lossy().to_string()
}

/// Reads the encrypted vault JSON blob. Returns null if not found.
#[tauri::command]
fn read_vault(path: String) -> Option<String> {
    fs::read_to_string(&path).ok()
}

/// Writes the encrypted vault JSON blob atomically.
/// The vault is still encrypted — Rust never sees plaintext values.
#[tauri::command]
fn write_vault(path: String, data: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Write to temp file then rename (atomic on most OSes)
    let tmp = path.clone() + ".tmp";
    fs::write(&tmp, &data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // System tray
            let quit   = MenuItem::with_id(app, "quit",   "Quit EnigmAgent", true, None::<&str>)?;
            let show   = MenuItem::with_id(app, "show",   "Open Vault",       true, None::<&str>)?;
            let menu   = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![vault_path, read_vault, write_vault])
        .run(tauri::generate_context!())
        .expect("error while running EnigmAgent");
}

fn main() {
    enigmagent_lib::run();
}
