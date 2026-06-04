import { Minus, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { closeWindow, minimizeWindow, Platform, toggleMaximizeWindow } from "../tauri";

type TitleBarProps = {
  platform: Platform;
};

export function TitleBar({ platform }: TitleBarProps) {
  const { t } = useTranslation();

  const controls = (
    <div className="window-controls">
      <button type="button" onClick={() => minimizeWindow()} aria-label={t("window.minimize")}>
        <Minus aria-hidden />
      </button>
      <button type="button" onClick={() => toggleMaximizeWindow()} aria-label={t("window.maximize")}>
        <Square aria-hidden />
      </button>
      <button className="close" type="button" onClick={() => closeWindow()} aria-label={t("window.close")}>
        <X aria-hidden />
      </button>
    </div>
  );

  return (
    <header className={`titlebar titlebar-${platform}`} data-tauri-drag-region>
      {platform === "macos" ? controls : null}
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src="/icons/zenith-sword.png" alt="" draggable={false} data-tauri-drag-region />
        <span data-tauri-drag-region>Zenith Codex</span>
      </div>
      {platform !== "macos" ? controls : null}
    </header>
  );
}
