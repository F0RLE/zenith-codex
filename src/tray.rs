use std::sync::Mutex;

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WebviewWindowBuilder, Wry,
};

use crate::{
    codex_config::{disable_provider, provider_has_token},
    platform::ui_text,
};

pub struct AppState {
    tray_toggle: Mutex<Option<MenuItem<Wry>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            tray_toggle: Mutex::new(None),
        }
    }
}

pub fn build_tray(app: &AppHandle, state: &State<AppState>) -> tauri::Result<()> {
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

pub fn refresh_tray_toggle(state: &State<AppState>) {
    if let Some(item) = state
        .tray_toggle
        .lock()
        .expect("tray state poisoned")
        .as_ref()
    {
        let _ = item.set_text(tray_toggle_label());
        let _ = item.set_enabled(provider_has_token());
    }
}

pub fn show_main_window(app: &AppHandle) {
    let window = if let Some(window) = app.get_webview_window("main") {
        window
    } else {
        let Some(config) = app
            .config()
            .app
            .windows
            .iter()
            .find(|window| window.label == "main")
        else {
            return;
        };
        match WebviewWindowBuilder::from_config(app, config).and_then(|builder| builder.build()) {
            Ok(window) => window,
            Err(_) => return,
        }
    };
    let _ = window.show();
    let _ = window.set_focus();
}

pub fn close_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.destroy();
    }
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

fn tray_toggle_label() -> &'static str {
    if provider_has_token() {
        ui_text("Stop", "Остановить")
    } else {
        ui_text("Start", "Запустить")
    }
}
