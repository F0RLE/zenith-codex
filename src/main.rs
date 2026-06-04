#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod codex_config;
mod files;
mod key_storage;
mod launcher;
mod platform;
mod tray;

use serde::Serialize;
use std::{env, net::TcpListener};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use crate::{
    codex_config::{enable_provider, ensure_provider_on_launch, provider_has_token},
    key_storage::{load_saved_app_key, save_app_key},
    launcher::launch_codex,
    platform::{platform_name, system_locale},
    tray::{build_tray, refresh_tray_toggle, AppState},
};

const SINGLE_INSTANCE_ADDR: &str = "127.0.0.1:47831";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UiState {
    provider_active: bool,
    saved_api_key: String,
}

#[tauri::command]
fn get_state() -> UiState {
    UiState {
        provider_active: provider_has_token(),
        saved_api_key: load_saved_app_key().unwrap_or_default(),
    }
}

#[tauri::command]
fn get_platform() -> &'static str {
    platform_name()
}

#[tauri::command]
fn get_system_locale() -> Option<String> {
    system_locale()
}

#[tauri::command]
fn save_key(api_key: String, app: AppHandle, state: State<AppState>) -> Result<String, String> {
    enable_provider(api_key.trim())?;
    save_app_key(api_key.trim())?;
    refresh_tray_toggle(&state);
    let _ = app.emit("zenith-state-changed", ());
    Ok("Ключ сохранен.".to_string())
}

#[tauri::command]
fn launch_saved_codex(app: AppHandle) -> Result<String, String> {
    let _ = ensure_provider_on_launch();
    if !provider_has_token() {
        return Err("Сначала сохраните API key.".to_string());
    }
    let message = launch_codex();
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    Ok(message)
}

fn main() {
    let _single_instance = match TcpListener::bind(SINGLE_INSTANCE_ADDR) {
        Ok(listener) => listener,
        Err(_) => return,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = ensure_provider_on_launch();
            let state = app.state::<AppState>();
            build_tray(&handle, &state)?;

            if env::args().any(|arg| arg == "--tray") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            get_platform,
            get_system_locale,
            save_key,
            launch_saved_codex
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Zenith Codex");
}
