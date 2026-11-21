/** Token counts the server measured; shown to users instead of money (docs/free-llm-allowance.md). */
export interface TokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  model_calls: number;
  /** A model call reported no usage, so the real total is higher. */
  incomplete?: boolean;
}

/** 123456 → "12.3万" (zh) / "123.5K" (en). Small counts stay exact. */
export function formatTokens(count: number, intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale, {
    notation: count >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(count);
}
