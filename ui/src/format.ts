export function formatMoney(cents?: number) {
  if (typeof cents !== "number") return "$0.00";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value?: number) {
  if (typeof value !== "number") return "0";
  return value.toLocaleString("en-US");
}
