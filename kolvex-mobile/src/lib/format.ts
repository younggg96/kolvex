/**
 * Signs for changes, returns and deltas.
 *
 * Every "+1.23%" / "−$4.50" in the product goes through here, so they read the same everywhere:
 * - a positive value gets "+", a negative one the typographic minus "−" (U+2212), never "-";
 * - zero, and anything that rounds to zero at the shown precision, gets no sign ("0.00%",
 *   never "+0.00%" or "−0.00%");
 * - the magnitude is formatted separately, so formatters never add their own "-".
 */
export const MINUS_SIGN = "−";

/** "+", "−" or "" for `value` as shown with `digits` decimals (unrounded when omitted). */
export function signFor(
  value: number,
  digits?: number,
): "+" | typeof MINUS_SIGN | "" {
  if (!Number.isFinite(value)) return "";
  const shown = digits === undefined ? value : Number(value.toFixed(digits));
  return shown > 0 ? "+" : shown < 0 ? MINUS_SIGN : "";
}

export interface WithSignOptions {
  /** Decimals the magnitude is shown with, so the sign agrees with the rounded figure. */
  digits?: number;
  /** false shows only the minus, for values whose positives carry no "+". Default true. */
  plus?: boolean;
}

/** Sign + `formatMagnitude(|value|)`, e.g. `withSign(-4.5, money)` → "−$4.50". */
export function withSign(
  value: number,
  formatMagnitude: (magnitude: number) => string,
  { digits, plus = true }: WithSignOptions = {},
): string {
  const sign = signFor(value, digits);
  return `${sign === "+" && !plus ? "" : sign}${formatMagnitude(Math.abs(value))}`;
}

/** A value already in percent units → "+1.23%"; "—" when missing. */
export function signedPercent(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return withSign(value, (magnitude) => `${magnitude.toFixed(digits)}%`, {
    digits,
  });
}
