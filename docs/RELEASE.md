# Release Flow

GitHub default branch: `nightly`.

Use this flow:

1. Open development pull requests into `nightly`.
2. When a build is ready, merge `nightly` into `main`.
3. Create a tag on the `main` commit:

```bash
git checkout main
git pull origin main
git tag v0.2.1
git push origin v0.2.1
```

The `Build` workflow runs on `main`, `nightly`, pull requests, and tags matching `v*`.

For `v*` tags it creates a draft GitHub Release and uploads release artifacts for:

- Windows x64
- Windows arm64
- macOS Apple Silicon arm64
- macOS Intel
- Linux x64
- Linux arm64

The app writes the Zenith provider into the local Codex config and uses:

```text
http://127.0.0.1:8080/v1
```
