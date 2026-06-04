export function formatMoney(cents?: number) {
  if (typeof cents !== "number") return "$0.00";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value?: number) {
  if (typeof value !== "number") return "0";
  return value.toLocaleString(undefined);
}
