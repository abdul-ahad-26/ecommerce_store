/** Format a number/Decimal-string as Pakistani Rupees, e.g. "Rs 4,790". */
export function formatPKR(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "Rs 0";
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
}
