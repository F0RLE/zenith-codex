import { Download, Eye, EyeOff, Play, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getPlatform,
  getState,
  launchCodex,
  onStateChanged,
  Platform,
  saveKey,
  updateAndRelaunch,
  UiState,
} from "./tauri";
import "./styles.css";

const initialState: UiState = {
  providerActive: false,
  savedApiKey: "",
};

export function App() {
  const [platform, setPlatform] = useState<Platform>("windows");
  const [state, setState] = useState<UiState>(initialState);
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLabel, setUpdateLabel] = useState<string | null>(null);
  const { t } = useTranslation();

  const canSave = apiKey.trim().length > 0 && !busy;
  const canLaunch = state.providerActive && !busy;
  const canUpdate = !busy && !updating;

  const platformLabel = useMemo(() => {
    if (platform === "macos") return "macOS";
    if (platform === "linux") return "Linux";
    return "Windows";
  }, [platform]);

  async function refreshState() {
    const next = await getState();
    setState(next);
    setApiKey((current) => current || next.savedApiKey || "");
  }

  useEffect(() => {
    getPlatform().then(setPlatform).catch(() => setPlatform("windows"));
    refreshState().catch(() => undefined);
    const unsubscribe = onStateChanged(() => {
      refreshState().catch(() => undefined);
    });
    return () => {
      unsubscribe.then((fn) => fn()).catch(() => undefined);
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKey = apiKey.trim();
    if (!nextKey) return;

    setBusy(true);
    setSaved(false);
    try {
      await saveKey(nextKey);
      await refreshState();
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

  async function handleUpdate() {
    if (updating) return;

    setBusy(true);
    setUpdating(true);
    setUpdateLabel(t("update.checking"));
    try {
      const result = await updateAndRelaunch((downloaded, total) => {
        if (!total) {
          setUpdateLabel(t("update.installing"));
          return;
        }
        const progress = Math.min(99, Math.round((downloaded / total) * 100));
        setUpdateLabel(`${progress}%`);
      });
      if (result === "none") {
        setUpdateLabel(t("update.upToDate"));
        window.setTimeout(() => setUpdateLabel(null), 1800);
      }
    } catch {
      setUpdateLabel(t("update.failed"));
      window.setTimeout(() => setUpdateLabel(null), 2200);
    } finally {
      setUpdating(false);
      setBusy(false);
    }
  }

  return (
    <main className={`app platform-${platform}`} aria-label={t("app.label", { platform: platformLabel })}>
      <form className="toolbar" onSubmit={handleSave}>
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

        <button className="update-button" type="button" disabled={!canUpdate} onClick={handleUpdate}>
          <Download aria-hidden />
          <span>{updateLabel ?? t("actions.update")}</span>
        </button>
      </form>
    </main>
  );
}
