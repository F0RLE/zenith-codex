# AGENTS.md

## Rules

- Default development branch is `nightly`.
- Open feature work into `nightly`; promote `nightly` to `main` only through a PR.
- Do not push normal product changes directly to `main`.
- Keep the public app free of old upstream provider URLs and private workspace paths.
- Use stable dependencies only. No beta, alpha, nightly, or prerelease packages unless explicitly approved.
- Keep UI text localized through `ui/src/i18n`.

## Checks

Run before committing:

```bash
npm run check
npm run build
cargo test --locked
```

For packaging changes:

```bash
npm run app:build
```

## Map

- `ui/src`: React + TypeScript frontend.
- `src`: Rust/Tauri desktop logic, tray, Codex config writes, process launch.
- `capabilities`: Tauri permissions.
- `scripts`: local Tauri dev/build environment helpers.
- `docs`: release and contributor documentation.
