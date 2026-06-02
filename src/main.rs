#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{
    env, fs,
    net::TcpListener,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};

#[cfg(target_os = "windows")]
use std::{ffi::OsStr, os::windows::process::CommandExt};

const PROVIDER_ID: &str = "codex_local_access";
const LEGACY_PROVIDER_ID: &str = "zenith";
const PROVIDER_NAME: &str = "Zenith";
const BASE_URL: &str = "http://127.0.0.1:8080/v1";
const CONFIG_FILE: &str = "config.toml";
const SAVED_KEY_FILE: &str = "zenith.key";
const BACKUP_SUFFIX: &str = ".zenith.bak";
const SINGLE_INSTANCE_ADDR: &str = "127.0.0.1:47831";

struct AppState {
    tray_toggle: Mutex<Option<MenuItem<Wry>>>,
}

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
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
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
fn launch_saved_codex() -> Result<String, String> {
    let _ = ensure_provider_on_launch();
    if !provider_has_token() {
        return Err("Сначала сохраните API key.".to_string());
    }
    Ok(launch_codex())
}

fn main() {
    let _single_instance = match TcpListener::bind(SINGLE_INSTANCE_ADDR) {
        Ok(listener) => listener,
        Err(_) => return,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            tray_toggle: Mutex::new(None),
        })
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

fn build_tray(app: &AppHandle, state: &State<AppState>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", ui_text("Show", "Показать"), true, None::<&str>)?;
    let toggle = MenuItem::with_id(
        app,
        "toggle",
        tray_toggle_label(),
        provider_has_token(),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", ui_text("Quit", "Выйти"), true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &quit])?;

    {
        let mut item = state.tray_toggle.lock().expect("tray state poisoned");
        *item = Some(toggle);
    }

    let icon = Image::from_bytes(include_bytes!("../icons/zenith-sword.png"))?;
    TrayIconBuilder::new()
        .tooltip("Zenith Codex")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "toggle" => toggle_provider_from_tray(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn toggle_provider_from_tray(app: &AppHandle) {
    let state = app.state::<AppState>();
    if provider_has_token() {
        let _ = disable_provider();
        refresh_tray_toggle(&state);
        let _ = app.emit("zenith-state-changed", ());
    } else {
        show_main_window(app);
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn refresh_tray_toggle(state: &State<AppState>) {
    if let Some(item) = state.tray_toggle.lock().expect("tray state poisoned").as_ref() {
        let _ = item.set_text(tray_toggle_label());
        let _ = item.set_enabled(provider_has_token());
    }
}

fn tray_toggle_label() -> &'static str {
    if provider_has_token() {
        ui_text("Stop", "Остановить")
    } else {
        ui_text("Start", "Запустить")
    }
}

fn ui_text(en: &'static str, ru: &'static str) -> &'static str {
    if system_language_is_russian() {
        ru
    } else {
        en
    }
}

fn system_language_is_russian() -> bool {
    system_locale()
        .map(|locale| locale.to_lowercase().starts_with("ru"))
        .unwrap_or(false)
}

fn system_locale() -> Option<String> {
    sys_locale::get_locale().or_else(|| env::var("LANG").ok())
}

fn enable_provider(api_key: &str) -> Result<(), String> {
    if api_key.is_empty() {
        return Err("Введите API key.".to_string());
    }

    let codex_home = default_codex_home();
    fs::create_dir_all(&codex_home)
        .map_err(|err| format!("Не удалось создать {}: {err}", codex_home.display()))?;

    let config_path = codex_home.join(CONFIG_FILE);
    let original = fs::read_to_string(&config_path).unwrap_or_default();
    backup_config(&config_path, &original)?;
    let next = upsert_zenith_provider(&original, api_key);
    atomic_write(&config_path, &next)?;
    write_codex_auth(api_key)
}

fn ensure_provider_on_launch() -> Result<(), String> {
    if let Some(api_key) = load_saved_app_key() {
        enable_provider(&api_key)?;
    } else if let Some(api_key) = load_zenith_key_from_codex_config() {
        save_app_key(&api_key)?;
        enable_provider(&api_key)?;
    }
    Ok(())
}

fn disable_provider() -> Result<(), String> {
    let config_path = default_codex_home().join(CONFIG_FILE);
    let original = fs::read_to_string(&config_path)
        .map_err(|err| format!("Не удалось прочитать {}: {err}", config_path.display()))?;
    backup_config(&config_path, &original)?;
    let next = remove_zenith_provider(&original);
    atomic_write(&config_path, &next)
}

fn provider_has_token() -> bool {
    let config_path = default_codex_home().join(CONFIG_FILE);
    let content = fs::read_to_string(config_path).unwrap_or_default();
    content
        .lines()
        .any(|line| line.trim().eq_ignore_ascii_case(&format!("model_provider = \"{PROVIDER_ID}\"")))
        && content.contains(&format!("[model_providers.{PROVIDER_ID}]"))
        && load_saved_app_key()
            .or_else(load_zenith_key_from_codex_config)
            .is_some()
}

fn load_zenith_key_from_codex_config() -> Option<String> {
    let config_path = default_codex_home().join(CONFIG_FILE);
    let content = fs::read_to_string(config_path).ok()?;
    let mut in_zenith = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_zenith = trimmed == format!("[model_providers.{PROVIDER_ID}]")
                || trimmed == format!("[model_providers.{LEGACY_PROVIDER_ID}]");
            continue;
        }
        if in_zenith {
            if let Some(value) = trimmed.strip_prefix("experimental_bearer_token = ") {
                let key = unquote_toml_string(value.trim())?;
                if !key.is_empty() {
                    return Some(key);
                }
            }
        }
    }

    None
}

fn save_app_key(api_key: &str) -> Result<(), String> {
    let dir = app_data_dir();
    fs::create_dir_all(&dir).map_err(|err| format!("Не удалось создать {}: {err}", dir.display()))?;
    fs::write(dir.join(SAVED_KEY_FILE), api_key)
        .map_err(|err| format!("Не удалось сохранить ключ приложения: {err}"))
}

fn write_codex_auth(api_key: &str) -> Result<(), String> {
    let codex_home = default_codex_home();
    fs::create_dir_all(&codex_home)
        .map_err(|err| format!("Не удалось создать {}: {err}", codex_home.display()))?;
    let content = format!(
        "{{\n  \"OPENAI_API_KEY\": \"{}\",\n  \"auth_mode\": \"apikey\"\n}}\n",
        escape_json_string(api_key)
    );
    atomic_write(&codex_home.join("auth.json"), &content)
}

fn load_saved_app_key() -> Option<String> {
    let key = fs::read_to_string(app_data_dir().join(SAVED_KEY_FILE)).ok()?;
    let key = key.trim().to_string();
    (!key.is_empty()).then_some(key)
}

fn upsert_zenith_provider(original: &str, api_key: &str) -> String {
    let without_old = remove_zenith_provider(original);
    let without_model_provider = remove_key_line(&without_old, "model_provider");
    let mut result = format!("model_provider = \"{PROVIDER_ID}\"");
    let preserved = without_model_provider.trim();
    if !preserved.is_empty() {
        result.push_str("\n\n");
        result.push_str(preserved);
    }
    result.push_str("\n\n");
    result.push_str(&format!("[model_providers.{PROVIDER_ID}]\n"));
    result.push_str(&format!("name = \"{PROVIDER_NAME}\"\n"));
    result.push_str(&format!("base_url = \"{}\"\n", escape_toml_string(BASE_URL)));
    result.push_str("wire_api = \"responses\"\n");
    result.push_str("requires_openai_auth = true\n");
    result.push_str(&format!(
        "experimental_bearer_token = \"{}\"\n",
        escape_toml_string(api_key)
    ));
    result.push_str("supports_websockets = false\n");
    result
}

fn remove_zenith_provider(original: &str) -> String {
    let without_section = remove_table(original, &format!("[model_providers.{PROVIDER_ID}]"));
    let without_section = remove_table(&without_section, &format!("[model_providers.{LEGACY_PROVIDER_ID}]"));
    remove_key_line(&without_section, "model_provider")
}

fn remove_key_line(content: &str, key: &str) -> String {
    let prefix = format!("{key} =");
    content
        .lines()
        .filter(|line| !line.trim().starts_with(&prefix))
        .collect::<Vec<_>>()
        .join("\n")
}

fn remove_table(content: &str, header: &str) -> String {
    let mut skipping = false;
    let mut out = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == header {
            skipping = true;
            continue;
        }
        if skipping && trimmed.starts_with('[') && trimmed.ends_with(']') {
            skipping = false;
        }
        if !skipping {
            out.push(line);
        }
    }

    out.join("\n")
}

fn backup_config(config_path: &Path, content: &str) -> Result<(), String> {
    if content.trim().is_empty() {
        return Ok(());
    }
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("Ошибка времени: {err}"))?
        .as_secs();
    let backup_path = config_path.with_file_name(format!("{CONFIG_FILE}.{timestamp}{BACKUP_SUFFIX}"));
    fs::write(&backup_path, content)
        .map_err(|err| format!("Не удалось создать backup {}: {err}", backup_path.display()))
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Некорректный путь: {}", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("Не удалось создать {}: {err}", parent.display()))?;
    let tmp = path.with_extension("toml.tmp");
    fs::write(&tmp, content).map_err(|err| format!("Не удалось записать {}: {err}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|err| {
        let _ = fs::remove_file(&tmp);
        format!("Не удалось заменить {}: {err}", path.display())
    })
}

fn default_codex_home() -> PathBuf {
    if cfg!(windows) {
        env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".codex")
    } else {
        env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".codex")
    }
}

fn app_data_dir() -> PathBuf {
    if cfg!(windows) {
        env::var_os("APPDATA")
            .map(PathBuf::from)
            .or_else(|| env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join("AppData/Roaming")))
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Zenith Codex")
    } else if cfg!(target_os = "macos") {
        env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library/Application Support/Zenith Codex")
    } else {
        env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
            .unwrap_or_else(|| PathBuf::from("."))
            .join("zenith-codex")
    }
}

fn launch_codex() -> String {
    #[cfg(target_os = "windows")]
    {
        if launch_codex_desktop().is_ok() {
            return "Codex запущен.".to_string();
        }
    }

    #[cfg(target_os = "windows")]
    {
        return match start_detached(PathBuf::from("codex")) {
            Ok(_) => "Codex запущен.".to_string(),
            Err(err) => format!("Ключ сохранен, но Codex не запустился: {err}"),
        };
    }

    #[cfg(target_os = "macos")]
    {
        return match Command::new("open").args(["-a", "Codex"]).spawn() {
            Ok(_) => "Codex запущен.".to_string(),
            Err(err) => format!("Ключ сохранен, но Codex не запустился: {err}"),
        };
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return match Command::new("codex").spawn() {
            Ok(_) => "Codex запущен.".to_string(),
            Err(err) => format!("Ключ сохранен, но Codex не запустился: {err}"),
        };
    }
}

fn start_detached(path: PathBuf) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut command = windows_hidden_command(path);
        if let Some(api_key) = load_saved_app_key().or_else(load_zenith_key_from_codex_config) {
            command.env("OPENAI_API_KEY", api_key);
        }
        return command
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut command = Command::new(path);
        if let Some(api_key) = load_saved_app_key().or_else(load_zenith_key_from_codex_config) {
            command.env("OPENAI_API_KEY", api_key);
        }
        command.spawn().map(|_| ()).map_err(|err| err.to_string())
    }
}

#[cfg(target_os = "windows")]
fn launch_codex_desktop() -> Result<(), String> {
    windows_hidden_command("explorer.exe")
        .arg(r"shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App")
        .spawn()
        .map(|_| ())
        .map_err(|err| err.to_string())
}

#[cfg(target_os = "windows")]
fn windows_hidden_command(program: impl AsRef<OsStr>) -> Command {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut command = Command::new(program);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

fn escape_toml_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn escape_json_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn unquote_toml_string(value: &str) -> Option<String> {
    let value = if let Some(value) = value.strip_prefix('"').and_then(|v| v.strip_suffix('"')) {
        value
    } else {
        value.strip_prefix('\'')?.strip_suffix('\'')?
    };
    let mut out = String::new();
    let mut escaped = false;
    for ch in value.chars() {
        if escaped {
            out.push(ch);
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else {
            out.push(ch);
        }
    }
    Some(out)
}
