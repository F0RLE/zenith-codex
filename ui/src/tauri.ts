import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export type Platform = "windows" | "macos" | "linux";

export type UiState = {
  providerActive: boolean;
  savedApiKey: string;
};

export function getState() {
  return invoke<UiState>("get_state");
}

export function getPlatform() {
  return invoke<Platform>("get_platform");
}

export function getSystemLocale() {
  return invoke<string | null>("get_system_locale");
}

export function saveKey(apiKey: string) {
  return invoke<string>("save_key", { apiKey });
}

export function launchCodex() {
  return invoke<string>("launch_saved_codex");
}

export async function updateAndRelaunch(onProgress?: (downloaded: number, total?: number) => void) {
  const update = await check();
  if (!update) {
    return "none" as const;
  }

  let downloaded = 0;
  let total: number | undefined;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? undefined;
      downloaded = 0;
      onProgress?.(downloaded, total);
    }
    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.(downloaded, total);
    }
  });
  await relaunch();
  return "installed" as const;
}

export function onStateChanged(callback: () => void) {
  return listen("zenith-state-changed", callback);
}
