use std::{path::PathBuf, process::Command};

use crate::codex_config::load_api_key_for_launch;

#[cfg(target_os = "windows")]
use std::{ffi::OsStr, os::windows::process::CommandExt};

pub fn launch_codex() -> String {
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
        if Command::new("open").args(["-a", "Codex"]).spawn().is_ok() {
            return "Codex запущен.".to_string();
        }
        return match start_detached(PathBuf::from("codex")) {
            Ok(_) => "Codex запущен.".to_string(),
            Err(err) => format!("Ключ сохранен, но Codex не запустился: {err}"),
        };
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return match start_detached(PathBuf::from("codex")) {
            Ok(_) => "Codex запущен.".to_string(),
            Err(err) => format!("Ключ сохранен, но Codex не запустился: {err}"),
        };
    }
}

pub fn is_codex_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        return is_windows_process_running("codex.exe")
            || is_windows_process_running("Codex.exe")
            || is_windows_process_running("OpenAI.Codex.exe");
    }

    #[cfg(target_os = "macos")]
    {
        return is_unix_process_running("Codex") || is_unix_process_running("codex");
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return is_unix_process_running("codex") || is_unix_process_running("Codex");
    }
}

fn start_detached(path: PathBuf) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut command = windows_hidden_command(path);
        if let Some(api_key) = load_api_key_for_launch() {
            command.env("OPENAI_API_KEY", api_key);
        }
        return command.spawn().map(|_| ()).map_err(|err| err.to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut command = Command::new(path);
        if let Some(api_key) = load_api_key_for_launch() {
            command.env("OPENAI_API_KEY", api_key);
        }
        command.spawn().map(|_| ()).map_err(|err| err.to_string())
    }
}

#[cfg(target_os = "windows")]
fn is_windows_process_running(image_name: &str) -> bool {
    let Ok(output) = Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {image_name}"), "/NH"])
        .output()
    else {
        return false;
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().any(|line| {
        line.to_ascii_lowercase()
            .starts_with(&image_name.to_ascii_lowercase())
    })
}

#[cfg(not(target_os = "windows"))]
fn is_unix_process_running(process_name: &str) -> bool {
    Command::new("pgrep")
        .args(["-x", process_name])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
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
