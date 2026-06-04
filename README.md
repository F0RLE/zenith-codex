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

## Updates

Zenith Codex checks GitHub Releases on startup and installs signed updates automatically when a new version is available.

## Development

```bash
npm install
npm run app:dev
```

To test against a local control API instead of production:

```powershell
$env:VITE_ZENITH_API_BASE_URL="http://127.0.0.1:8080/v1"
npm run app:dev
```

Verify before release:

```bash
npm run verify
```

Clean local frontend artifacts:

```bash
npm run clean
```

Release and contributor workflow lives in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/RELEASE.md](docs/RELEASE.md).

## License

MIT
