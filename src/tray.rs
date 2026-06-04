use std::sync::Mutex;

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, Url, Wry,
};

use crate::{
    codex_config::{disable_provider, provider_has_token},
    platform::ui_text,
};

pub struct AppState {
    tray_toggle: Mutex<Option<MenuItem<Wry>>>,
    home_url: Mutex<Option<Url>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            tray_toggle: Mutex::new(None),
            home_url: Mutex::new(None),
        }
    }
}

pub fn remember_home_url(state: &State<AppState>, url: Url) {
    let mut home_url = state.home_url.lock().expect("app state poisoned");
    *home_url = Some(url);
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
    if let Some(window) = app.get_webview_window("main") {
        let should_restore = window
            .url()
            .map(|url| url.scheme() == "about")
            .unwrap_or(false);
        if should_restore {
            let state = app.state::<AppState>();
            let home_url = state.home_url.lock().expect("app state poisoned").clone();
            if let Some(url) = home_url {
                let _ = window.navigate(url);
            }
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(url) = Url::parse("about:blank") {
            let _ = window.navigate(url);
        }
        let _ = window.hide();
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
