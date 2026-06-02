# Zenith Codex

Native Tauri v2 desktop app for saving a Zenith API key into Codex.

The endpoint is fixed to the Zenith API gateway:

```text
http://127.0.0.1:8080/v1
```

The app writes this to Codex `config.toml`:

```toml
model_provider = "codex_local_access"

[model_providers.codex_local_access]
name = "Zenith"
base_url = "http://127.0.0.1:8080/v1"
wire_api = "responses"
requires_openai_auth = true
supports_websockets = false
experimental_bearer_token = "..."
```

Existing `config.toml` is backed up before every write.

## Behavior

- The UI contains only API key input, save, and launch.
- The tray menu contains `Показать`, one `Запустить/Остановить` item, and `Выйти`.
- `Запустить` is disabled until a Zenith API key is saved.
- Closing the window hides it to tray.
- Only one app instance can run.
- The app does not register Windows/macOS/Linux startup hooks.

## Build

```bash
cargo build --release
```

The ready Windows executable is copied to:

```text
windows/Zenith Codex.exe
```

## License

MIT © FORLE
