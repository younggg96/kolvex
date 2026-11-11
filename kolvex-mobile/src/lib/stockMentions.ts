/* eslint-disable @typescript-eslint/array-type -- verbatim copy of the Web file, checked by tests/web-source-parity */
/**
 * Stock mentions in model-written Markdown.
 *
 * Assistant answers name tickers constantly (`MSFT`, `NVDA`, `$TSLA`). This module
 * finds them and turns each one into a link to that symbol's quotes page, so the
 * renderer can draw a company logo instead of plain text. Pure functions plus a
 * small remark plugin: no React, no network.
 *
 * Where a ticker is trusted:
 *  - a table cell in a ticker column (header says 标的/股票/代码/ticker/symbol, or the
 *    column is nothing but tickers);
 *  - `$TICKER` anywhere in prose — an explicit cash-tag can only mean a symbol;
 *  - `` `TICKER` `` in inline code;
 *  - a bare `TICKER` only when the same answer already identified it as a symbol.
 *
 * Anything else is left as text: `AI`, `EPS` and `PE` are words, not stocks.
 */

/** Custom URL scheme the renderer turns into a logo link. */
export const STOCK_LINK_SCHEME = "stock:";

export function stockLinkUrl(symbol: string) {
  return `${STOCK_LINK_SCHEME}${symbol}`;
}

/** The symbol inside a stock link, or null when the href is a normal URL. */
export function symbolFromStockLink(url: string | undefined): string | null {
  if (!url || !url.startsWith(STOCK_LINK_SCHEME)) return null;
  const symbol = url.slice(STOCK_LINK_SCHEME.length).trim().toUpperCase();
  return symbol || null;
}

/**
 * Upper-case tokens that look like tickers but are standard financial or product
 * shorthand. Bare `AI` is a topic; `$AI` is a symbol, and that form stays linkable.
 */
const NOT_A_TICKER = new Set([
  "AI", "ML", "LLM", "GPT", "API", "SDK", "UI", "UX", "OS", "PC", "GPU", "CPU", "TPU", "NPU",
  "ASIC", "HBM", "DRAM", "NAND", "EUV", "IC", "IDC", "TAM", "SAM", "SOM", "ESG", "KPI", "OKR",
  "EPS", "PE", "PB", "PS", "PEG", "ROE", "ROA", "ROI", "ROIC", "ROCE", "FCF", "EBIT", "EBITDA",
  "GAAP", "NONGAAP", "TTM", "YOY", "QOQ", "MOM", "YTD", "CAGR", "ARR", "RPO", "NGS", "SBC",
  "IPO", "ETF", "ETN", "ADR", "REIT", "SPAC", "M&A", "IR", "PR", "BUYBACK",
  "FED", "SEC", "CPI", "PPI", "GDP", "PMI", "FOMC", "PCE", "JOLTS", "ISM",
  "USD", "EUR", "CNY", "JPY", "HKD", "GBP", "BTC", "ETH", "SOL", "XRP",
  "IV", "HV", "OI", "RSI", "MACD", "EMA", "SMA", "ATR", "VWAP", "BOLL", "KDJ", "DCF", "WACC",
  "VWMA", "WMA", "HMA", "DEMA", "TEMA", "KAMA", "ADX", "CCI", "OBV", "MFI", "PSAR", "STOCH",
  "ROC", "CMF", "ICHIMOKU", "BPS", "PIPS", "EPS", "ROIC", "NOPAT", "EV", "FIB",
  "NAV", "AUM", "IRR", "NPV", "LTV", "CAC", "ARPU", "GMV", "Capex".toUpperCase(), "OPEX",
  "CEO", "CFO", "CTO", "COO", "CIO", "CRO", "CMO", "CHRO", "VP", "SVP", "EVP",
  "USA", "US", "UK", "EU", "CN", "HK", "JP", "DE", "FR", "IN",
  "NYSE", "NASDAQ", "SPX", "NDX", "DJIA", "VIX", "RUT", "SOX",
  "FY", "Q1", "Q2", "Q3", "Q4", "H1", "H2", "Y1", "Y2", "E1", "E2",
  "FAQ", "PDF", "CSV", "HTTP", "HTTPS", "URL", "JSON", "XML", "SQL", "CSS", "HTML",
  // All-caps words an answer may shout: BUY/HOLD are decisions, not symbols.
  "THE", "AND", "FOR", "NOT", "YOU", "ALL", "ANY", "NEW", "NOW", "ONE", "TWO", "TEN", "SIX",
  "BUY", "SELL", "HOLD", "LONG", "SHORT", "RISK", "RISKS", "CASH", "DEBT", "BOND", "FUND",
  "STOCK", "STOCKS", "MARKET", "PRICE", "TRADE", "WATCH", "NOTE", "TLDR", "SUMMARY", "KEY",
  "PROS", "CONS", "UPSIDE", "DOWNSIDE", "TARGET", "STOP", "LOSS", "GAIN", "TOTAL", "AVERAGE",
  "HIGH", "LOW", "OPEN", "CLOSE", "VOLUME", "WEEK", "MONTH", "YEAR", "DAYS", "NEXT", "LAST",
  "OK", "MR", "MS", "PM", "AM", "VS", "EG", "IE", "AKA", "TBD", "TBA", "NA", "TBC",
  "BULL", "BEAR", "NEUTRAL", "MIXED", "BUY", "SELL", "HOLD", "TP", "SL", "DD", "IRR", "NPV",
]);

/** Normalized shape of a routable ticker: `MSFT`, `BRK.B`, `BTC-USD`. */
const SYMBOL_SHAPE = /^[A-Z][A-Z0-9.-]{0,9}$/;

/**
 * A token in prose: `MSFT`, `BRK.B`, or a cash tag `$MSFT`. Both ends are anchored so
 * `EBITDA` never yields `BITDA` and `AWS` inside a sentence is not read mid-word.
 */
const PROSE_TOKEN = /(?<![A-Za-z0-9])(\$?)([A-Za-z][A-Za-z0-9]{0,4}(?:\.[A-Za-z]{1,2})?)(?![A-Za-z0-9])/g;

export function normalizeSymbol(raw: string) {
  return raw.trim().replace(/^\$/, "").toUpperCase();
}

/** True when a bare (unmarked) token may stand for a symbol without other evidence. */
export function isBareTicker(token: string) {
  // A bare ticker is written in caps by convention; `nvda` is prose, not a symbol.
  if (token !== token.toUpperCase()) return false;
  const symbol = normalizeSymbol(token);
  if (!SYMBOL_SHAPE.test(symbol)) return false;
  if (symbol.length < 2) return false; // `T`, `V`, `F` are words as often as tickers
  return !NOT_A_TICKER.has(symbol);
}

/** True when a token is shaped like a ticker, ignoring the word list. */
export function isSymbolShape(token: string) {
  return SYMBOL_SHAPE.test(normalizeSymbol(token));
}

/** True when a table header names a ticker column. */
export function isTickerHeader(text: string) {
  return /(标的|股票|代码|证券|品种|ticker|symbol|code|stock|instrument)/i.test(text.trim());
}

/** Symbols are the first column often enough that a table without a named column still counts. */
function looksLikeTickerColumn(values: string[]) {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  if (filled.length < 2) return false;
  return filled.every((value) => isBareTicker(value) || isHeroTicker(value));
}

/** A one- or two-letter ticker is acceptable inside an explicit ticker column. */
function isHeroTicker(value: string) {
  const symbol = normalizeSymbol(value);
  return SYMBOL_SHAPE.test(symbol) && /[A-Z]/.test(symbol) && !NOT_A_TICKER.has(symbol) && !/\s/.test(value);
}

export interface MentionNode {
  type: string;
  value?: string;
  url?: string;
  children?: MentionNode[];
  [key: string]: unknown;
}

function textOf(node: MentionNode): string {
  if (typeof node.value === "string" && (node.type === "text" || node.type === "inlineCode")) return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function stockNode(symbol: string): MentionNode {
  return { type: "link", url: stockLinkUrl(symbol), children: [{ type: "text", value: symbol }] };
}

function tableCells(row: MentionNode): MentionNode[] {
  return (row.children ?? []).filter((cell) => cell.type === "tableCell");
}

/** Symbols named by a ticker column, plus the columns themselves for cell-level linking. */
function scanTables(tree: MentionNode, universe: Set<string>) {
  for (const node of tree.children ?? []) {
    if (node.type === "table") {
      const rows = (node.children ?? []).filter((row) => row.type === "tableRow");
      const [header, ...body] = rows;
      if (header) {
        const heads = tableCells(header).map(textOf);
        const columns = heads.map((text) => text.trim()).length;
        for (let column = 0; column < columns; column += 1) {
          const values = body.map((row) => textOf(tableCells(row)[column] ?? { type: "empty" }));
          const named = isTickerHeader(heads[column] ?? "");
          if (!named && !looksLikeTickerColumn(values)) continue;
          for (const value of values) {
            const symbol = normalizeSymbol(value);
            if (isBareTicker(symbol) || (SYMBOL_SHAPE.test(symbol) && !NOT_A_TICKER.has(symbol) && !/\s/.test(value.trim()))) {
              universe.add(symbol);
            }
          }
        }
      }
    }
    scanTables(node, universe);
  }
}

/**
 * Symbols written in free text — a user typing "分析一下 NVDA 和 AMD" already told the
 * answer which tickers it is about. Used to seed a conversation's known set.
 */
export function findSymbols(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(PROSE_TOKEN)) {
    const [, marker, token] = match;
    if (marker !== "$" && token !== token.toUpperCase()) continue;
    const symbol = normalizeSymbol(token);
    if (!isSymbolShape(symbol)) continue;
    if (marker !== "$" && !isBareTicker(symbol)) continue;
    if (!found.includes(symbol)) found.push(symbol);
  }
  return found;
}

/** Split prose into text runs and symbol runs. */
export function splitStockMentions(text: string, universe: Set<string>): Array<string | { symbol: string }> {
  const parts: Array<string | { symbol: string }> = [];
  let cursor = 0;
  for (const match of text.matchAll(PROSE_TOKEN)) {
    const [whole, marker, token] = match;
    const symbol = normalizeSymbol(token);
    if (!SYMBOL_SHAPE.test(symbol)) continue;
    const shouted = token === token.toUpperCase();
    // A cash tag always means a symbol, except for unit labels: "$B" and "$M" in a table
    // header are billions and millions. A bare token links only once the answer itself has
    // identified it (ticker table, workspace tickers, the report's own ticker): linking every
    // all-caps word turned "AWS" and "BITDA" into fake stock links.
    const trusted = (marker === "$" && symbol.length >= 2) || (shouted && universe.has(symbol));
    if (!trusted) continue;
    const start = match.index ?? 0;
    if (start > cursor) parts.push(text.slice(cursor, start));
    // The `$` is decoration on a cash tag, not part of the identity.
    parts.push({ symbol });
    cursor = start + whole.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function inlineCodeSymbol(value: string, universe: Set<string>) {
  // Same caps convention as prose: `AVGO` is a ticker, `code` is a word in backticks.
  if (value.trim() !== value.trim().toUpperCase()) return null;
  const symbol = normalizeSymbol(value);
  if (!isSymbolShape(symbol) || NOT_A_TICKER.has(symbol)) return null;
  universe.add(symbol);
  return symbol;
}

function transform(node: MentionNode, universe: Set<string>) {
  if (!node.children) return;
  const next: MentionNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      for (const part of splitStockMentions(child.value, universe)) {
        next.push(typeof part === "string" ? { type: "text", value: part } : stockNode(part.symbol));
      }
      continue;
    }
    if (child.type === "inlineCode" && typeof child.value === "string") {
      const symbol = inlineCodeSymbol(child.value, universe);
      if (symbol) {
        next.push(stockNode(symbol));
        continue;
      }
    }
    // Never rewrite the inside of an existing link, a code fence, or raw HTML.
    if (!["link", "code", "html", "image", "definition"].includes(child.type)) transform(child, universe);
    next.push(child);
  }
  node.children = next;
}

/**
 * remark plugin: links stock mentions so the renderer can draw logos.
 * `knownSymbols` seeds the trusted set (for example the workspace's tickers).
 */
export function remarkStockMentions(options: { knownSymbols?: string[] } = {}) {
  return (tree: MentionNode) => {
    const universe = new Set(
      (options.knownSymbols ?? []).map(normalizeSymbol).filter((symbol) => isSymbolShape(symbol)),
    );
    scanTables(tree, universe);
    transform(tree, universe);
  };
}
