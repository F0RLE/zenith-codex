import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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

export function saveKey(apiKey: string) {
  return invoke<string>("save_key", { apiKey });
}

export function launchCodex() {
  return invoke<string>("launch_saved_codex");
}

export function onStateChanged(callback: () => void) {
  return listen("zenith-state-changed", callback);
}
