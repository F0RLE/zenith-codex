import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoney, formatNumber } from "../format";
import type { UsageLogEntry } from "../tauri";

type HistoryPanelProps = {
  entries: UsageLogEntry[];
  error: boolean;
  loading: boolean;
  canLoadMore: boolean;
  onLoadLatest: () => void;
  onLoadMore: () => void;
};

export function HistoryPanel({
  entries,
  error,
  loading,
  canLoadMore,
  onLoadLatest,
  onLoadMore,
}: HistoryPanelProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <section className="history-panel empty-panel">
        <Clock aria-hidden />
        <span>{t("history.failed")}</span>
      </section>
    );
  }

  if (!loading && entries.length === 0) {
    return (
      <section className="history-panel empty-panel">
        <Clock aria-hidden />
        <span>{t("history.empty")}</span>
      </section>
    );
  }

  return (
    <section className="history-panel" aria-label={t("history.label")}>
      <div className="history-list">
        {entries.map((entry) => (
          <article className="history-row" key={entry.id}>
            <div>
              <strong>{entry.model ?? t("history.unknownModel")}</strong>
              <span>{formatDate(entry.createdAt)}</span>
            </div>
            <div>
              <strong>{formatMoney(entry.costCents)}</strong>
              <span>{formatNumber(entry.totalTokens)} {t("history.tokens")}</span>
            </div>
            <div>
              <span>{t("stats.inputTokens")}: {formatNumber(entry.inputTokens)}</span>
              <span>{t("stats.outputTokens")}: {formatNumber(entry.outputTokens)}</span>
            </div>
            <div>
              <span>{t("stats.cachedTokens")}: {formatNumber(entry.cachedInputTokens)}</span>
              <span>{entry.status}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="history-actions">
        <button type="button" onClick={onLoadLatest} disabled={loading} title={t("history.latest")}>
          <ChevronLeft aria-hidden />
          <span>{t("history.latest")}</span>
        </button>
        <button type="button" onClick={onLoadMore} disabled={loading || !canLoadMore} title={t("history.more")}>
          <span>{loading ? t("history.loading") : t("history.more")}</span>
          <ChevronRight aria-hidden />
        </button>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
