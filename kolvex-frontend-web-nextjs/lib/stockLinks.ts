/**
 * Canonical stock → quotes-page link helpers.
 *
 * Every stock identity surfaced in the UI (logo pill, ticker chip, tag, table
 * row) must be able to reach that stock's quotes page at
 * `/dashboard/market/<TICKER>`. Import these helpers instead of hand-building
 * the path so the URL shape, encoding and validation stay consistent.
 *
 * This module is intentionally pure TypeScript: no React, no `"use client"`,
 * no dependencies — it is safe to import from server components, route
 * handlers and client components alike.
 */

/** Base path of the per-symbol quotes page. */
export const MARKET_STOCK_BASE = "/dashboard/market";

/**
 * Characters that can never appear in a tradable single-symbol path segment:
 * `^` (indexes), `=` (futures), `/` and `\` (path separators), `?`/`#`/`%`
 * (URL delimiters/escapes), FX-style pairs and whitespace.
 */
const INVALID_SYMBOL_CHARS = /[\^=/\\?#%\s]/;

/** Tradable US tickers: letters, digits, dots and dashes (e.g. BRK.B, BTC-USD). */
const VALID_SYMBOL_CHARS = /^[A-Z0-9.-]+$/;

/** Longest symbol we accept (covers prefixed tickers such as BRK.A). */
const MAX_SYMBOL_LENGTH = 21;

/**
 * Normalizes a raw symbol to the canonical display/URL form: trimmed and
 * upper-cased. Returns `""` for empty or whitespace-only input.
 */
export function normalizeStockSymbol(symbol: string): string {
  if (typeof symbol !== "string") return "";
  return symbol.trim().toUpperCase();
}

/**
 * True when `symbol` identifies a single tradable instrument we can route to.
 * Rejects empty/whitespace input, index/future/FX notation and anything that
 * is not a short `A-Z0-9.-` token.
 */
export function isValidStockSymbol(symbol: string): boolean {
  const normalized = normalizeStockSymbol(symbol);
  if (!normalized) return false;
  if (normalized.length > MAX_SYMBOL_LENGTH) return false;
  if (INVALID_SYMBOL_CHARS.test(normalized)) return false;
  if (!VALID_SYMBOL_CHARS.test(normalized)) return false;
  // A symbol made only of dots/dashes carries no identity.
  return /[A-Z0-9]/.test(normalized);
}

/**
 * True when `href` is a safe same-origin path we may echo back as a `?from=`
 * return target. Rejects absolute URLs, protocol-relative (`//`) and
 * backslash-escaped paths.
 */
export function isSafeReturnHref(href: string | undefined | null): href is string {
  if (typeof href !== "string") return false;
  const trimmed = href.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return false;
  return true;
}

/**
 * Builds the quotes-page href for `symbol`, always `/dashboard/market/<TICKER>`
 * for any non-empty symbol, optionally carrying a `?from=<returnPath>` so the
 * destination can offer a "back to context" affordance.
 *
 * Invalid symbols still produce the normalized path (the quotes page owns the
 * final validation); use {@link marketStockUrl} when a routable URL is required.
 */
export function marketStockHref(symbol: string, from?: string): string {
  const normalized = normalizeStockSymbol(symbol);
  const href = `${MARKET_STOCK_BASE}/${encodeURIComponent(normalized)}`;
  if (!isSafeReturnHref(from)) return href;
  return `${href}?${new URLSearchParams({ from })}`;
}

/**
 * Builds the quotes-page href for `symbol`, or `null` when the symbol is not a
 * routable single ticker — callers should then render plain text.
 */
export function marketStockUrl(symbol: string): string | null {
  if (!isValidStockSymbol(symbol)) return null;
  return marketStockHref(symbol);
}
