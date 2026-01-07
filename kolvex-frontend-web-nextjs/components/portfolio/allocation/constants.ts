// ================== COLOR PALETTE ==================

export const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#00C805", // Primary Green
  Technology: "#00C805",
  Financials: "#3b82f6", // Blue
  Financial: "#3b82f6",
  "Health Care": "#f43f5e", // Rose
  Healthcare: "#f43f5e",
  "Consumer Discretionary": "#fbbf24", // Amber
  "Consumer Staples": "#a3e635", // Lime
  "Communication Services": "#0ea5e9", // Sky Blue
  Industrials: "#94a3b8", // Slate
  Energy: "#ef4444", // Red
  Utilities: "#06b6d4", // Cyan
  "Real Estate": "#f97316", // Orange
  Materials: "#14b8a6", // Teal
  Funds: "#6366f1", // Indigo
  ETF: "#6366f1",
  Other: "#64748b", // Slate
};

export const DEFAULT_COLORS = [
  "#00C805", // Primary
  "#3b82f6", // Blue
  "#0ea5e9", // Sky Blue
  "#f43f5e", // Rose
  "#fbbf24", // Amber
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#a3e635", // Lime
  "#64748b", // Slate
];

export function getSectorColor(sector: string, index: number): string {
  return SECTOR_COLORS[sector] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

