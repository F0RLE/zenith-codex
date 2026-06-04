# Contributing

Zenith Codex is the public desktop app for configuring Codex to use Zenith.

## Branches

- `nightly` is the default development branch.
- `main` is the stable release branch.
- Open normal pull requests into `nightly`.
- Promote `nightly` into `main` only through a pull request after CI is green.

## Pull Request Flow

```text
feature/<name> -> PR into nightly
nightly -> PR into main
main -> vX.Y.Z tag -> GitHub Release
```

Do not push product changes directly to `main`.

## Local Checks

Run these before opening a pull request:

```bash
npm run check
npm run build
cargo test --locked
```

For packaging changes, also run:

```bash
npm run app:build
```

Full release builds are verified by GitHub Actions on Windows, macOS, Linux, x64, and ARM64.

## Scope

- Frontend code lives in `ui/src`.
- Tauri/Rust app code lives in `src`.
- Tauri capabilities live in `capabilities`.
- Build helpers live in `scripts`.
- Release notes and packaging rules live in `docs`.

Keep the app pointed at the Zenith gateway. Do not add old upstream provider URLs to the public desktop app.
