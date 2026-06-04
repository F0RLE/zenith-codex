import { Wallet } from "lucide-react";
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

const QUICK_AMOUNTS = [10, 25, 50, 100];

type TopUpPanelProps = {
  disabled: boolean;
  error: boolean;
  loading: boolean;
  onTopUp: (amountUsd: number) => Promise<void>;
};

export function TopUpPanel({ disabled, error, loading, onTopUp }: TopUpPanelProps) {
  const [amount, setAmount] = useState("25");
  const { t } = useTranslation();

  const amountUsd = parseUsdAmount(amount);
  const canSubmit = !disabled && !loading && amountUsd !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || amountUsd === null) return;
    await onTopUp(amountUsd);
  }

  if (disabled) {
    return (
      <section className="top-up-panel compact" aria-label={t("topUp.label")}>
        <Wallet aria-hidden />
        <span>{t("topUp.saveKeyFirst")}</span>
      </section>
    );
  }

  return (
    <form className="top-up-panel" aria-label={t("topUp.label")} onSubmit={submit}>
      <div className="top-up-main">
        <div className="top-up-field">
          <Wallet aria-hidden />
          <span>$</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            disabled={disabled || loading}
            aria-label={t("topUp.amount")}
          />
        </div>

        <div className="top-up-presets">
          {QUICK_AMOUNTS.map((value) => (
            <button
              className={Number(amount) === value ? "selected" : ""}
              key={value}
              type="button"
              disabled={disabled || loading}
              onClick={() => setAmount(String(value))}
            >
              ${value}
            </button>
          ))}
        </div>

        <button className="top-up-submit" type="submit" disabled={!canSubmit}>
          {loading ? t("topUp.opening") : t("topUp.openBot")}
        </button>
      </div>

      <span className={`top-up-hint ${error ? "error-text" : ""}`}>
        {error ? t("topUp.failed") : disabled ? t("topUp.saveKeyFirst") : t("topUp.secure")}
      </span>
    </form>
  );
}

function parseUsdAmount(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 1 || amount > 10_000) return null;
  return Math.round(amount * 100) / 100;
}
