import { Eye, EyeOff, Play, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getPlatform,
  getState,
  launchCodex,
  onStateChanged,
  Platform,
  saveKey,
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

  const canSave = apiKey.trim().length > 0 && !busy;
  const canLaunch = state.providerActive && !busy;

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

  return (
    <main className={`app platform-${platform}`} aria-label={`Zenith Codex for ${platformLabel}`}>
      <form className="toolbar" onSubmit={handleSave}>
        <label className="api-field">
          <span className="sr-only">API key</span>
          <input
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setSaved(false);
            }}
            type={keyVisible ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="API key"
          />
          <button
            className="icon-button"
            type="button"
            title={keyVisible ? "Hide API key" : "Show API key"}
            aria-label={keyVisible ? "Hide API key" : "Show API key"}
            onClick={() => setKeyVisible((value) => !value)}
          >
            {keyVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        </label>

        <button className={`save-button ${saved ? "saved" : ""}`} type="submit" disabled={!canSave}>
          <Save aria-hidden />
          <span>{saved ? "Saved" : "Save"}</span>
        </button>

        <button className="launch-button" type="button" disabled={!canLaunch} onClick={handleLaunch}>
          <Play aria-hidden />
          <span>Launch</span>
        </button>
      </form>
    </main>
  );
}
