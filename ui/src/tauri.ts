import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export type Platform = "windows" | "macos" | "linux";

export type UiState = {
  providerActive: boolean;
  codexRunning: boolean;
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

export type UsageLogEntry = {
  id: number;
  model: string | null;
  requestId: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  status: string;
  createdAt: string;
};

const DEFAULT_API_BASE_URL = "https://api.zenithmarket.dev/v1";
const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_ZENITH_API_BASE_URL);
const BROWSER_KEY_STORAGE = "zenith-codex.dev.api-key";

export function getState() {
  if (!isTauriRuntime()) {
    const savedApiKey = window.localStorage.getItem(BROWSER_KEY_STORAGE) ?? "";
    return Promise.resolve({
      providerActive: Boolean(savedApiKey),
      codexRunning: false,
      savedApiKey,
    });
  }

  return invoke<UiState>("get_state");
}

export function getPlatform() {
  if (!isTauriRuntime()) {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("mac")) return Promise.resolve<Platform>("macos");
    if (userAgent.includes("linux")) return Promise.resolve<Platform>("linux");
    return Promise.resolve<Platform>("windows");
  }

  return invoke<Platform>("get_platform");
}

export function getSystemLocale() {
  if (!isTauriRuntime()) {
    return Promise.resolve(navigator.language || null);
  }

  return invoke<string | null>("get_system_locale");
}

export function saveKey(apiKey: string) {
  if (!isTauriRuntime()) {
    window.localStorage.setItem(BROWSER_KEY_STORAGE, apiKey);
    return Promise.resolve(apiKey);
  }

  return invoke<string>("save_key", { apiKey });
}

export function resetKey() {
  if (!isTauriRuntime()) {
    window.localStorage.removeItem(BROWSER_KEY_STORAGE);
    return Promise.resolve("");
  }

  return invoke<string>("reset_key");
}

export function launchCodex() {
  if (!isTauriRuntime()) {
    return Promise.resolve("Browser preview mode");
  }

  return invoke<string>("launch_saved_codex");
}

export function openTopUpUrl(url: string) {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve();
  }

  return invoke<void>("open_top_up_url", { url });
}

export function minimizeWindow() {
  if (!isTauriRuntime()) return Promise.resolve();
  return getCurrentWindow().minimize();
}

export function toggleMaximizeWindow() {
  if (!isTauriRuntime()) return Promise.resolve();
  return getCurrentWindow().toggleMaximize();
}

export function closeWindow() {
  if (!isTauriRuntime()) return Promise.resolve();
  return getCurrentWindow().close();
}

export async function createTopUpIntent(apiKey: string, amountCents: number) {
  const response = await fetch(`${API_BASE_URL}/desktop/top-up-intents`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ amountCents }),
  });
  if (!response.ok) {
    throw new Error(`top-up intent failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: {
      botUrl?: string;
      url?: string;
      startParameter?: string;
      startPayload?: string;
      code?: string;
    };
  };
  const data = payload.data ?? {};
  if (data.botUrl) return data.botUrl;
  if (data.url) return data.url;

  const start = data.startParameter ?? data.startPayload ?? data.code;
  if (!start) {
    throw new Error("top-up intent response is missing a start payload");
  }
  return `https://t.me/zenith_service_bot?start=${encodeURIComponent(start)}`;
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

export async function getKeyUsageHistory(apiKey: string, sinceId?: number) {
  const params = new URLSearchParams({ limit: "8" });
  if (sinceId) params.set("sinceId", String(sinceId));

  const response = await fetch(`${API_BASE_URL}/zenith/key/usage?${params.toString()}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`usage history request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data: {
      usage: UsageLogEntry[];
      limit: number;
      sinceId: number | null;
    };
  };
  return payload.data;
}

export async function updateAndRelaunch(onProgress?: (downloaded: number, total?: number) => void) {
  if (!isTauriRuntime()) {
    onProgress?.(0, 0);
    return "none" as const;
  }

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
  if (!isTauriRuntime()) {
    return Promise.resolve(() => undefined);
  }

  return listen("zenith-state-changed", callback);
}

function normalizeApiBaseUrl(value?: string) {
  return (value?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
