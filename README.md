# Zenith Codex

Native Tauri v2 desktop app for saving a Zenith API key into Codex.

## Stack

- Rust + Tauri 2 for the desktop shell, tray, Codex config writes, and process launch.
- React + TypeScript + Vite for the frontend.
- Platform-aware CSS for Windows, macOS, and Linux UI tuning.
- Tauri updater for signed one-click updates from GitHub Releases.

The endpoint is fixed to the Zenith API gateway:

```text
https://api.zenithmarket.dev/v1
```

The app writes this to Codex `config.toml`:

```toml
model_provider = "codex_local_access"

[model_providers.codex_local_access]
name = "Zenith"
base_url = "https://api.zenithmarket.dev/v1"
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

## Development

```bash
npm install
npm run app:dev
```

Verify before committing:

```bash
npm run check
npm run build
cargo test --locked
```

## Contributing

Default development branch is `nightly`.

Use this order:

```text
feature branch -> PR into nightly -> CI -> merge
nightly -> PR into main -> CI -> merge
main -> vX.Y.Z tag -> GitHub Release
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/RELEASE.md](docs/RELEASE.md) before opening release changes.

## Build

```bash
npm run app:build
```

On Windows, local app builds automatically use Rust from
`%LOCALAPPDATA%\Zenith\tools\rust` when it exists. Local builds do not create
signed updater artifacts unless `TAURI_SIGNING_PRIVATE_KEY` is set.

Signed release builds are produced by GitHub Actions:

```bash
npm run app:build:signed
```

## License

MIT © FORLE
