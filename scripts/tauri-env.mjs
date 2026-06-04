import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export function withZenithRustEnv(env = process.env) {
  const next = { ...env };
  const nodeBin = dirname(process.execPath);
  next.PATH = `${nodeBin};${next.PATH ?? ""}`;

  if (process.platform === "win32") {
    const localAppData = next.LOCALAPPDATA;
    if (localAppData) {
      const rustRoot = join(localAppData, "Zenith", "tools", "rust");
      const cargoHome = join(rustRoot, "cargo-home");
      const rustupHome = join(rustRoot, "rustup-home");
      const cargoBin = join(cargoHome, "bin");

      if (existsSync(join(cargoBin, "cargo.exe"))) {
        next.CARGO_HOME = cargoHome;
        next.RUSTUP_HOME = rustupHome;
        next.PATH = `${cargoBin};${next.PATH}`;
      }
    }
  }

  return next;
}

export function tauriInvocation(args) {
  const localCli = join(process.cwd(), "node_modules", "@tauri-apps", "cli", "tauri.js");

  if (existsSync(localCli)) {
    return {
      command: process.execPath,
      args: [localCli, ...args],
      shell: false,
    };
  }

  return {
    command: process.platform === "win32" ? "tauri.cmd" : "tauri",
    args,
    shell: process.platform === "win32",
  };
}
