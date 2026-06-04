# Release Flow

GitHub default branch: `main`.

Use this flow:

1. Open development pull requests into `main`.
2. Merge into `main` only after CI is green.
3. Create a tag on the `main` commit:

```bash
git checkout main
git pull origin main
git tag v1.0.0
git push origin v1.0.0
```

The `Build` workflow runs on `main`, `nightly`, pull requests, and tags matching `v*`.

The frontend is built with React, TypeScript, and Vite before Tauri packaging.

Updates are served from the latest GitHub Release through `latest.json`. Tauri signs update artifacts with `TAURI_SIGNING_PRIVATE_KEY` from GitHub Secrets and verifies them with the public key stored in `tauri.conf.json`.

For `v*` tags it creates a draft GitHub Release and uploads release artifacts for:

- Windows x64
- Windows arm64
- macOS Apple Silicon arm64
- macOS Intel
- Linux x64
- Linux arm64

The app writes the Zenith provider into the local Codex config and uses:

```text
https://api.zenithmarket.dev/v1
```
