// ================== UTILITY FUNCTIONS ==================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(2)}%`;
}

// ================== OPTION PARSING ==================

/**
 * Parse option symbol to extract call/put type
 * Example: "SOFI 270115C00022000" -> { type: "call" }
 * The format is: SYMBOL YYMMDD[C/P]PRICE
 */
export function parseOptionSymbol(symbol: string): { type: "call" | "put" } | null {
  // Match pattern: any chars followed by space, then 6 digits, then C or P
  const match = symbol.match(/\s\d{6}([CP])/i);
  if (match) {
    return { type: match[1].toUpperCase() === "C" ? "call" : "put" };
  }
  return null;
}

/**
 * Extract the underlying symbol from an option symbol
 * Example: "SOFI 270115C00022000" -> "SOFI"
 */
export function getUnderlyingSymbol(
  symbol: string,
  underlyingSymbol?: string,
  isOption?: boolean
): string {
  if (!isOption) return symbol;
  if (underlyingSymbol) return underlyingSymbol;
  // Fallback: extract from option symbol (everything before the space)
  return symbol.split(" ")[0];
}

