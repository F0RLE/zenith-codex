import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CreditCard, History, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HistoryPanel } from "./components/HistoryPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsGrid } from "./components/StatsGrid";
import { TitleBar } from "./components/TitleBar";
import { Toolbar } from "./components/Toolbar";
import { TopUpPanel } from "./components/TopUpPanel";
import {
  createTopUpIntent,
  getKeyStats,
  getKeyUsageHistory,
  getPlatform,
  getState,
  KeyStats,
  launchCodex,
  onStateChanged,
  openTopUpUrl,
  Platform,
  resetKey,
  saveKey,
  updateAndRelaunch,
  UsageLogEntry,
  UiState,
} from "./tauri";
import "./styles.css";

const initialState: UiState = {
  providerActive: false,
  codexRunning: false,
  savedApiKey: "",
};
const STATS_REFRESH_MS = 60_000;
type AppTab = "stats" | "history" | "topUp" | "settings";

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
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("stats");
  const [history, setHistory] = useState<UsageLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyCanLoadMore, setHistoryCanLoadMore] = useState(false);
  const updatingRef = useRef(false);
  const startupUpdateCheckedRef = useRef(false);
  const { t } = useTranslation();

  const canSave = apiKey.trim().length > 0 && !busy;
  const canLaunch = state.providerActive && !busy;
  const canUpdate = !busy && !updating;
  const canReset = (state.providerActive || Boolean(state.savedApiKey)) && !busy;
  const statsKey = state.savedApiKey.trim();
  const hasStatsKey = Boolean(statsKey);

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
    const key = (keyOverride ?? state.savedApiKey).trim();
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

  async function refreshHistory(keyOverride?: string, sinceId?: number) {
    const key = (keyOverride ?? state.savedApiKey).trim();
    if (!key) {
      setHistory([]);
      setHistoryCanLoadMore(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const result = await getKeyUsageHistory(key, sinceId);
      setHistory((current) => (sinceId ? [...current, ...result.usage] : result.usage));
      setHistoryCanLoadMore(result.usage.length >= result.limit);
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
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
      .then((next) => {
        refreshStats(next.savedApiKey).catch(() => undefined);
        refreshHistory(next.savedApiKey).catch(() => undefined);
      })
      .catch(() => undefined);
    if (!startupUpdateCheckedRef.current) {
      startupUpdateCheckedRef.current = true;
      installUpdate(true).catch(() => undefined);
    }
    const unsubscribe = onStateChanged(() => {
      refreshState()
        .then((next) => {
          refreshStats(next.savedApiKey).catch(() => undefined);
          refreshHistory(next.savedApiKey).catch(() => undefined);
        })
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
      setHistory([]);
      setHistoryCanLoadMore(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      refreshStats(statsKey).catch(() => undefined);
      refreshHistory(statsKey).catch(() => undefined);
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
      await refreshHistory(nextKey);
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
      setHistory([]);
      setHistoryCanLoadMore(false);
      await refreshState();
    } finally {
      setBusy(false);
    }
  }

  async function handleTopUp(amountUsd: number) {
    const key = statsKey;
    if (!key) return;

    setTopUpLoading(true);
    setTopUpError(false);
    try {
      const url = await createTopUpIntent(key, Math.round(amountUsd * 100));
      await openTopUpUrl(url);
    } catch {
      setTopUpError(true);
    } finally {
      setTopUpLoading(false);
    }
  }

  return (
    <main className={`app platform-${platform}`} aria-label={t("app.label", { platform: platformLabel })}>
      <TitleBar platform={platform} />
      <section className="panel">
        <Toolbar
          apiKey={apiKey}
          canLaunch={canLaunch}
          canSave={canSave}
          codexRunning={state.codexRunning}
          keyVisible={keyVisible}
          saved={saved}
          onApiKeyChange={(value) => {
            setApiKey(value);
            setSaved(false);
          }}
          onKeyVisibleChange={setKeyVisible}
          onLaunch={handleLaunch}
          onSubmit={handleSave}
        />

        <nav className="tabs" aria-label={t("tabs.label")}>
          <TabButton
            active={activeTab === "stats"}
            icon={<BarChart3 aria-hidden />}
            label={t("tabs.stats")}
            onClick={() => setActiveTab("stats")}
          />
          <TabButton
            active={activeTab === "history"}
            icon={<History aria-hidden />}
            label={t("tabs.history")}
            onClick={() => setActiveTab("history")}
          />
          <TabButton
            active={activeTab === "topUp"}
            icon={<CreditCard aria-hidden />}
            label={t("tabs.topUp")}
            onClick={() => setActiveTab("topUp")}
          />
          <TabButton
            active={activeTab === "settings"}
            icon={<Settings aria-hidden />}
            label={t("tabs.settings")}
            onClick={() => setActiveTab("settings")}
          />
        </nav>

        <section className="tab-content">
          {activeTab === "stats" ? <StatsGrid keyStats={keyStats} /> : null}
          {activeTab === "history" ? (
            <HistoryPanel
              entries={history}
              error={historyError}
              loading={historyLoading}
              canLoadMore={historyCanLoadMore}
              onLoadLatest={() => refreshHistory()}
              onLoadMore={() => refreshHistory(undefined, history[history.length - 1]?.id)}
            />
          ) : null}
          {activeTab === "topUp" ? (
            <TopUpPanel disabled={!hasStatsKey} error={topUpError} loading={topUpLoading} onTopUp={handleTopUp} />
          ) : null}
          {activeTab === "settings" ? (
            <SettingsPanel
              canReset={canReset}
              canUpdate={canUpdate}
              updateLabel={updateLabel}
              onInstallUpdate={() => installUpdate(false)}
              onReset={handleReset}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
