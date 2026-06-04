import { Download, Eye, EyeOff, Play, RefreshCw, RotateCcw, Save } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getKeyStats,
  getPlatform,
  getState,
  KeyStats,
  launchCodex,
  onStateChanged,
  Platform,
  resetKey,
  saveKey,
  updateAndRelaunch,
  UiState,
} from "./tauri";
import "./styles.css";

const initialState: UiState = {
  providerActive: false,
  savedApiKey: "",
};
const STATS_REFRESH_MS = 60_000;

export function App() {
  const [platform, setPlatform] = useState<Platform>("windows");
  const [state, setState] = useState<UiState>(initialState);
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLabel, setUpdateLabel] = useState<string | null>(null);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [keyStats, setKeyStats] = useState<KeyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const updatingRef = useRef(false);
  const startupUpdateCheckedRef = useRef(false);
  const { t } = useTranslation();

  const canSave = apiKey.trim().length > 0 && !busy;
  const canLaunch = state.providerActive && !busy;
  const canUpdate = !busy && !updating;
  const canReset = (state.providerActive || Boolean(state.savedApiKey)) && !busy;
  const statsKey = (apiKey || state.savedApiKey).trim();
  const hasStatsKey = Boolean(statsKey);
  const canRefreshStats = hasStatsKey && !statsLoading;

  const platformLabel = useMemo(() => {
    if (platform === "macos") return "macOS";
    if (platform === "linux") return "Linux";
    return "Windows";
  }, [platform]);

  async function refreshState() {
    const next = await getState();
    setState(next);
    setApiKey((current) => current || next.savedApiKey || "");
    return next;
  }

  async function refreshStats(keyOverride?: string) {
    const key = ((keyOverride ?? apiKey) || state.savedApiKey).trim();
    if (!key) {
      setKeyStats(null);
      return;
    }

    setStatsLoading(true);
    setStatsError(false);
    try {
      setKeyStats(await getKeyStats(key));
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }

  const installUpdate = useCallback(
    async (automatic = false) => {
      if (updatingRef.current) return;

      updatingRef.current = true;
      setUpdating(true);
      setUpdateLabel(t("update.checking"));
      if (!automatic) setBusy(true);
      try {
        const result = await updateAndRelaunch((downloaded, total) => {
          setUpdateVisible(true);
          if (!total) {
            setUpdateLabel(t("update.installing"));
            return;
          }
          const progress = Math.min(99, Math.round((downloaded / total) * 100));
          setUpdateLabel(`${progress}%`);
        });
        if (result === "none") {
          setUpdateVisible(false);
          setUpdateLabel(null);
        }
      } catch {
        setUpdateVisible(!automatic);
        setUpdateLabel(automatic ? null : t("update.failed"));
      } finally {
        updatingRef.current = false;
        setUpdating(false);
        if (!automatic) setBusy(false);
      }
    },
    [t],
  );

  useEffect(() => {
    getPlatform().then(setPlatform).catch(() => setPlatform("windows"));
    refreshState()
      .then((next) => refreshStats(next.savedApiKey))
      .catch(() => undefined);
    if (!startupUpdateCheckedRef.current) {
      startupUpdateCheckedRef.current = true;
      installUpdate(true).catch(() => undefined);
    }
    const unsubscribe = onStateChanged(() => {
      refreshState()
        .then((next) => refreshStats(next.savedApiKey))
        .catch(() => undefined);
    });
    return () => {
      unsubscribe.then((fn) => fn()).catch(() => undefined);
    };
  }, [installUpdate]);

  useEffect(() => {
    if (!hasStatsKey) {
      setKeyStats(null);
      setStatsError(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      refreshStats(statsKey).catch(() => undefined);
    }, STATS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hasStatsKey, statsKey]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKey = apiKey.trim();
    if (!nextKey) return;

    setBusy(true);
    setSaved(false);
    try {
      await saveKey(nextKey);
      await refreshState();
      await refreshStats(nextKey);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunch() {
    if (!state.providerActive) return;

    setBusy(true);
    try {
      await launchCodex();
      await refreshState();
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!canReset) return;

    setBusy(true);
    setSaved(false);
    try {
      await resetKey();
      setApiKey("");
      setKeyStats(null);
      await refreshState();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`app platform-${platform}`} aria-label={t("app.label", { platform: platformLabel })}>
      <section className="panel">
        <form className={`toolbar ${updateVisible ? "has-update" : ""}`} onSubmit={handleSave}>
          <label className="api-field">
            <span className="sr-only">{t("apiKey.label")}</span>
            <input
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setSaved(false);
              }}
              type={keyVisible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={t("apiKey.label")}
            />
            <button
              className="icon-button"
              type="button"
              title={keyVisible ? t("apiKey.hide") : t("apiKey.show")}
              aria-label={keyVisible ? t("apiKey.hide") : t("apiKey.show")}
              onClick={() => setKeyVisible((value) => !value)}
            >
              {keyVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          </label>

          <button className={`save-button ${saved ? "saved" : ""}`} type="submit" disabled={!canSave}>
            <Save aria-hidden />
            <span>{saved ? t("actions.saved") : t("actions.save")}</span>
          </button>

          <button className="launch-button" type="button" disabled={!canLaunch} onClick={handleLaunch}>
            <Play aria-hidden />
            <span>{t("actions.launch")}</span>
          </button>

          <button className="reset-button" type="button" disabled={!canReset} onClick={handleReset}>
            <RotateCcw aria-hidden />
            <span>{t("actions.reset")}</span>
          </button>

          {updateVisible ? (
            <button className="update-button" type="button" disabled={!canUpdate} onClick={() => installUpdate(false)}>
              <Download aria-hidden />
              <span>{updateLabel ?? t("actions.update")}</span>
            </button>
          ) : null}

          <button
            className="refresh-button"
            type="button"
            disabled={!canRefreshStats}
            onClick={() => refreshStats()}
            title={t("actions.refreshStats")}
            aria-label={t("actions.refreshStats")}
          >
            <RefreshCw aria-hidden />
          </button>
        </form>

        <div className="status-row">
          <span className={`status-dot ${state.providerActive ? "active" : ""}`} />
          <span>{state.providerActive ? t("status.ready") : t("status.empty")}</span>
          {keyStats?.maskedKey ? <strong>{keyStats.maskedKey}</strong> : null}
          {statsLoading ? <span>{t("stats.loading")}</span> : null}
          {statsError ? <span className="error-text">{t("stats.failed")}</span> : null}
        </div>

        {hasStatsKey ? (
          <div className="stats-grid" aria-label={t("stats.label")}>
            <Stat label={t("stats.balance")} value={formatMoney(keyStats?.balanceCents)} accent />
            <Stat label={t("stats.spent")} value={formatMoney(keyStats?.spentCents)} />
            <Stat label={t("stats.requests")} value={formatNumber(keyStats?.requests)} />
            <Stat label={t("stats.totalTokens")} value={formatNumber(keyStats?.totalTokens)} />
            <Stat label={t("stats.inputTokens")} value={formatNumber(keyStats?.inputTokens)} />
            <Stat label={t("stats.cachedTokens")} value={formatNumber(keyStats?.cachedInputTokens)} />
            <Stat label={t("stats.outputTokens")} value={formatNumber(keyStats?.outputTokens)} />
            <Stat label={t("stats.month")} value={formatMoney(keyStats?.monthlySpentCents)} />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMoney(cents?: number) {
  if (typeof cents !== "number") return "$0.00";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value?: number) {
  if (typeof value !== "number") return "0";
  return value.toLocaleString("en-US");
}
