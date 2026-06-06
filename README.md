# Zenith Codex

Desktop app for connecting Codex to Zenith API.

## What It Does

- Saves your Zenith API key.
- Writes the Zenith provider into Codex config.
- Launches Codex from the app.
- Shows key balance, spending, requests, and token usage.
- Opens the Telegram bot for balance top-ups.

Telegram bot: [@zenith_service_bot](https://t.me/zenith_service_bot)

## API Gateway

The app uses:

```text
https://api.zenithmarket.dev/v1
```

## Architecture

The frontend is intentionally thin: it renders UI, keeps form state, and calls Tauri commands. Request handling, API calls, response normalization, validation, formatting, top-up intent handling, key storage, Codex config writes, and process control belong in the Rust backend under `src-tauri/src`.

## Updates

Zenith Codex checks GitHub Releases on startup and installs signed updates automatically when a new version is available.

## Development

```bash
cd src
bun install
bun run app:dev
```

Source layout:

- `src` - React/Vite frontend package.
- `src-tauri` - Rust/Tauri backend and desktop packaging.
- `.github/tools` - local and CI build helpers.

Verify before release:

```bash
cd src
bun run verify
```

Clean local frontend artifacts:

```bash
cd src
bun run clean
```

Release and contributor workflow lives in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/RELEASE.md](docs/RELEASE.md).

## License

MIT
