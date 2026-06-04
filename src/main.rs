#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod codex_config;
mod files;
mod key_storage;
mod launcher;
mod platform;
mod tray;

use serde::Serialize;
use std::{
    env,
    io::Write,
    net::{TcpListener, TcpStream},
    process::Command,
    thread,
};
use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};
use url::Url;

use crate::{
    codex_config::{
        enable_provider, ensure_provider_on_launch, load_api_key_for_launch, provider_has_token,
        reset_provider,
    },
    key_storage::{load_saved_app_key, save_app_key},
    launcher::{is_codex_running, launch_codex},
    platform::{platform_name, system_locale},
    tray::{build_tray, close_main_window, AppState},
};

const SINGLE_INSTANCE_ADDR: &str = "127.0.0.1:47831";
const TOP_UP_BOT_URL: &str = "https://t.me/zenith_service_bot";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UiState {
    provider_active: bool,
    codex_running: bool,
    saved_api_key: String,
}

#[tauri::command]
fn get_state() -> UiState {
    let _ = ensure_provider_on_launch();
    UiState {
        provider_active: provider_has_token(),
        codex_running: is_codex_running(),
        saved_api_key: load_saved_app_key()
            .or_else(load_api_key_for_launch)
            .unwrap_or_default(),
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
fn save_key(api_key: String, app: AppHandle) -> Result<String, String> {
    enable_provider(api_key.trim())?;
    save_app_key(api_key.trim())?;
    let _ = app.emit("zenith-state-changed", ());
    Ok("Ключ сохранен.".to_string())
}

#[tauri::command]
fn reset_key(app: AppHandle) -> Result<String, String> {
    reset_provider()?;
    let _ = app.emit("zenith-state-changed", ());
    Ok("Настройки восстановлены.".to_string())
}

#[tauri::command]
fn launch_saved_codex(app: AppHandle) -> Result<String, String> {
    let _ = ensure_provider_on_launch();
    if !provider_has_token() {
        return Err("Сначала сохраните API key.".to_string());
    }
    let message = launch_codex();
    close_main_window(&app);
    let _ = app.emit("zenith-state-changed", ());
    Ok(message)
}

#[tauri::command]
fn open_top_up_url(url: String) -> Result<(), String> {
    if !is_allowed_top_up_url(&url) {
        return Err("Unsupported top-up URL.".to_string());
    }
    open_external_url(&url)
}

fn is_allowed_top_up_url(value: &str) -> bool {
    let Ok(input) = Url::parse(value) else {
        return false;
    };
    let Ok(base) = Url::parse(TOP_UP_BOT_URL) else {
        return false;
    };

    input.scheme() == base.scheme()
        && input.host_str() == base.host_str()
        && input.port_or_known_default() == base.port_or_known_default()
        && input.path() == base.path()
        && input.fragment().is_none()
}

fn open_external_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", url])
        .spawn();

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(url).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open").arg(url).spawn();

    status.map(|_| ()).map_err(|err| err.to_string())
}

fn main() {
    let _single_instance = match TcpListener::bind(SINGLE_INSTANCE_ADDR) {
        Ok(listener) => listener,
        Err(_) => {
            if let Ok(mut stream) = TcpStream::connect(SINGLE_INSTANCE_ADDR) {
                let _ = stream.write_all(b"show");
            }
            return;
        }
    };

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = ensure_provider_on_launch();
            let state = app.state::<AppState>();
            build_tray(&handle, &state)?;

            let instance_handle = handle.clone();
            thread::spawn(move || {
                for stream in _single_instance.incoming() {
                    if stream.is_ok() {
                        crate::tray::show_main_window(&instance_handle);
                    }
                }
            });

            if env::args().any(|arg| arg == "--tray") {
                close_main_window(&handle);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.destroy();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            get_platform,
            get_system_locale,
            save_key,
            reset_key,
            launch_saved_codex,
            open_top_up_url
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Zenith Codex");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { api, code, .. } = event {
            let state = app_handle.state::<AppState>();
            if code.is_none() && state.should_prevent_exit() {
                api.prevent_exit();
            }
        }
    });
}
