import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export type Platform = "windows" | "macos" | "linux";

export type UiState = {
  providerActive: boolean;
  savedApiKey: string;
};

export type KeyStats = {
  maskedKey: string;
  label: string | null;
  enabled: boolean;
  status: string;
  balanceCents: number;
  spentCents: number;
  totalCreditsCents: number;
  requests: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  dailySpentCents: number;
  weeklySpentCents: number;
  monthlySpentCents: number;
};

const API_BASE_URL = "https://api.zenithmarket.dev/v1";

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

export function resetKey() {
  return invoke<string>("reset_key");
}

export function launchCodex() {
  return invoke<string>("launch_saved_codex");
}

export async function getKeyStats(apiKey: string) {
  const response = await fetch(`${API_BASE_URL}/zenith/key/stats`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (response.ok) {
    const payload = (await response.json()) as { data: KeyStats };
    return payload.data;
  }

  const fallback = await fetch(`${API_BASE_URL}/key`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!fallback.ok) {
    throw new Error(`stats request failed: ${fallback.status}`);
  }

  const payload = (await fallback.json()) as {
    data: {
      key?: string;
      label?: string | null;
      enabled?: boolean;
      limit_remaining_cents?: number;
      usage_cents?: number;
      limit_cents?: number;
      requests?: number;
      input_tokens?: number;
      cached_input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      usage_daily_cents?: number;
      usage_weekly_cents?: number;
      usage_monthly_cents?: number;
    };
  };
  return {
    maskedKey: payload.data.key ?? "",
    label: payload.data.label ?? null,
    enabled: payload.data.enabled ?? false,
    status: payload.data.enabled ? "active" : "disabled",
    balanceCents: payload.data.limit_remaining_cents ?? 0,
    spentCents: payload.data.usage_cents ?? 0,
    totalCreditsCents: payload.data.limit_cents ?? 0,
    requests: payload.data.requests ?? 0,
    inputTokens: payload.data.input_tokens ?? 0,
    cachedInputTokens: payload.data.cached_input_tokens ?? 0,
    outputTokens: payload.data.output_tokens ?? 0,
    totalTokens: payload.data.total_tokens ?? 0,
    dailySpentCents: payload.data.usage_daily_cents ?? 0,
    weeklySpentCents: payload.data.usage_weekly_cents ?? 0,
    monthlySpentCents: payload.data.usage_monthly_cents ?? 0,
  };
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
