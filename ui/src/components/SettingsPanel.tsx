import { RefreshCw, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

type SettingsPanelProps = {
  canReset: boolean;
  canUpdate: boolean;
  updateLabel: string | null;
  onInstallUpdate: () => void;
  onReset: () => void;
};

export function SettingsPanel({
  canReset,
  canUpdate,
  updateLabel,
  onInstallUpdate,
  onReset,
}: SettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="settings-panel" aria-label={t("settings.label")}>
      <button className="settings-zone" type="button" disabled={!canReset} onClick={onReset}>
        <span className="settings-action-main">
          <RotateCcw aria-hidden />
          <span>{t("actions.reset")}</span>
        </span>
        <span className="settings-hint">{t("settings.resetHint")}</span>
      </button>
      <button className="settings-zone" type="button" disabled={!canUpdate} onClick={onInstallUpdate}>
        <span className="settings-action-main">
          <RefreshCw aria-hidden />
          <span>{updateLabel ?? t("actions.update")}</span>
        </span>
        <span className="settings-hint">{t("settings.autoUpdate")}</span>
      </button>
    </section>
  );
}
