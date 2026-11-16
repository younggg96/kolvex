// Sector colours are the --sector-* tokens in app/globals.css.

export const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "rgb(var(--sector-0))",
  Technology: "rgb(var(--sector-0))",
  Financials: "rgb(var(--sector-1))",
  Financial: "rgb(var(--sector-1))",
  "Health Care": "rgb(var(--sector-3))",
  Healthcare: "rgb(var(--sector-3))",
  "Consumer Discretionary": "rgb(var(--sector-4))",
  "Consumer Staples": "rgb(var(--sector-8))",
  "Communication Services": "rgb(var(--sector-2))",
  Industrials: "rgb(var(--sector-10))",
  Energy: "rgb(var(--sector-11))",
  Utilities: "rgb(var(--sector-5))",
  "Real Estate": "rgb(var(--sector-6))",
  Materials: "rgb(var(--sector-7))",
  Funds: "rgb(var(--sector-12))",
  ETF: "rgb(var(--sector-12))",
  Other: "rgb(var(--sector-9))",
};

export const DEFAULT_COLORS = [
  "rgb(var(--sector-0))",
  "rgb(var(--sector-1))",
  "rgb(var(--sector-2))",
  "rgb(var(--sector-3))",
  "rgb(var(--sector-4))",
  "rgb(var(--sector-5))",
  "rgb(var(--sector-6))",
  "rgb(var(--sector-7))",
  "rgb(var(--sector-8))",
  "rgb(var(--sector-9))",
];

export function getSectorColor(sector: string, index: number): string {
  return SECTOR_COLORS[sector] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}
