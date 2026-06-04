use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    files::{atomic_write, escape_json_string, escape_toml_string, unquote_toml_string},
    key_storage::{load_saved_app_key, save_app_key},
    platform::default_codex_home,
};

const PROVIDER_ID: &str = "codex_local_access";
const LEGACY_PROVIDER_ID: &str = "zenith";
const PROVIDER_NAME: &str = "Zenith";
const BASE_URL: &str = "https://api.zenithmarket.dev/v1";
const CONFIG_FILE: &str = "config.toml";
const BACKUP_SUFFIX: &str = ".zenith.bak";

pub fn enable_provider(api_key: &str) -> Result<(), String> {
    if api_key.is_empty() {
        return Err("Введите API key.".to_string());
    }

    let codex_home = default_codex_home();
    fs::create_dir_all(&codex_home)
        .map_err(|err| format!("Не удалось создать {}: {err}", codex_home.display()))?;

    let config_path = codex_home.join(CONFIG_FILE);
    let original = fs::read_to_string(&config_path).unwrap_or_default();
    let next = upsert_zenith_provider(&original);
    if next != original {
        backup_config(&config_path, &original)?;
        atomic_write(&config_path, &next)?;
    }
    write_codex_auth(api_key)
}

pub fn ensure_provider_on_launch() -> Result<(), String> {
    if let Some(api_key) = load_saved_app_key() {
        enable_provider(&api_key)?;
    } else if let Some(api_key) = load_codex_auth_key().or_else(load_zenith_key_from_codex_config) {
        save_app_key(&api_key)?;
        enable_provider(&api_key)?;
    }
    Ok(())
}

pub fn disable_provider() -> Result<(), String> {
    let config_path = default_codex_home().join(CONFIG_FILE);
    let original = fs::read_to_string(&config_path)
        .map_err(|err| format!("Не удалось прочитать {}: {err}", config_path.display()))?;
    backup_config(&config_path, &original)?;
    let next = remove_zenith_provider(&original);
    atomic_write(&config_path, &next)
}

pub fn provider_has_token() -> bool {
    let config_path = default_codex_home().join(CONFIG_FILE);
    let content = fs::read_to_string(config_path).unwrap_or_default();
    content.lines().any(|line| {
        line.trim()
            .eq_ignore_ascii_case(&format!("model_provider = \"{PROVIDER_ID}\""))
    }) && content.contains(&format!("[model_providers.{PROVIDER_ID}]"))
        && load_api_key_for_launch().is_some()
}

pub fn load_api_key_for_launch() -> Option<String> {
    load_saved_app_key()
        .or_else(load_codex_auth_key)
        .or_else(load_zenith_key_from_codex_config)
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

fn load_codex_auth_key() -> Option<String> {
    let auth_path = default_codex_home().join("auth.json");
    let content = fs::read_to_string(auth_path).ok()?;
    let auth: serde_json::Value = serde_json::from_str(&content).ok()?;
    let key = auth
        .get("OPENAI_API_KEY")
        .and_then(serde_json::Value::as_str)?
        .trim()
        .to_string();
    (!key.is_empty()).then_some(key)
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

fn upsert_zenith_provider(original: &str) -> String {
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
    result.push_str(&format!(
        "base_url = \"{}\"\n",
        escape_toml_string(BASE_URL)
    ));
    result.push_str("wire_api = \"responses\"\n");
    result.push_str("requires_openai_auth = true\n");
    result.push_str("supports_websockets = false\n");
    result
}

fn remove_zenith_provider(original: &str) -> String {
    let without_section = remove_table(original, &format!("[model_providers.{PROVIDER_ID}]"));
    let without_section = remove_table(
        &without_section,
        &format!("[model_providers.{LEGACY_PROVIDER_ID}]"),
    );
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
    let backup_path =
        config_path.with_file_name(format!("{CONFIG_FILE}.{timestamp}{BACKUP_SUFFIX}"));
    fs::write(&backup_path, redact_config_secrets(content))
        .map_err(|err| format!("Не удалось создать backup {}: {err}", backup_path.display()))
}

fn redact_config_secrets(content: &str) -> String {
    content
        .lines()
        .map(|line| {
            if line.trim_start().starts_with("experimental_bearer_token =") {
                "experimental_bearer_token = \"<redacted>\""
            } else {
                line
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}
