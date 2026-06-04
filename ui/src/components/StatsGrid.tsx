import { useTranslation } from "react-i18next";
import { formatMoney, formatNumber } from "../format";
import type { KeyStats } from "../tauri";

type StatsGridProps = {
  keyStats: KeyStats | null;
};

export function StatsGrid({ keyStats }: StatsGridProps) {
  const { t } = useTranslation();

  return (
    <div className="stats-grid" aria-label={t("stats.label")}>
      <Stat label={t("stats.balance")} value={formatMoney(keyStats?.balanceCents)} tone="positive" />
      <Stat label={t("stats.spent")} value={formatMoney(keyStats?.spentCents)} tone="money" />
      <Stat label={t("stats.requests")} value={formatNumber(keyStats?.requests)} />
      <Stat label={t("stats.totalTokens")} value={formatNumber(keyStats?.totalTokens)} />
      <Stat label={t("stats.inputTokens")} value={formatNumber(keyStats?.inputTokens)} />
      <Stat label={t("stats.cachedTokens")} value={formatNumber(keyStats?.cachedInputTokens)} />
      <Stat label={t("stats.outputTokens")} value={formatNumber(keyStats?.outputTokens)} />
      <Stat label={t("stats.month")} value={formatMoney(keyStats?.monthlySpentCents)} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "money";
}) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
