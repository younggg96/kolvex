// Earnings API types and utilities

export interface EarningsEvent {
  symbol: string;
  companyName: string;
  date: string;
  time: "bmo" | "amc" | string; // bmo = before market open, amc = after market close
  logo?: string;
  eps?: {
    estimate?: number;
    actual?: number;
    surprise?: number;
  };
  revenue?: {
    estimate?: number;
    actual?: number;
    surprise?: number;
  };
  // Legacy fields for compatibility
  epsEstimate?: number;
  epsActual?: number;
  epsSurprise?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  revenueSurprise?: number;
  // Additional fields
  sector?: string;
  industry?: string;
  marketCap?: number;
  quarter?: string;
  year?: number;
}

export interface GroupedEarnings {
  [date: string]: EarningsEvent[];
}

/**
 * Group earnings events by date
 */
export function groupEarningsByDate(earnings: EarningsEvent[]): GroupedEarnings {
  return earnings.reduce((groups, event) => {
    const date = event.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as GroupedEarnings);
}

/**
 * Format date for display (e.g., "Monday, Dec 9")
 */
export function formatEarningsDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // Add time to avoid timezone issues
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get time label for earnings
 */
export function getEarningsTimeLabel(time: string): string {
  switch (time) {
    case "bmo":
      return "Before Market Open";
    case "amc":
      return "After Market Close";
    default:
      return time || "TBD";
  }
}

/**
 * Format number as currency
 */
export function formatCurrency(value: number | undefined): string {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format number as compact (1B, 1M, etc.)
 */
export function formatCompactNumber(value: number | undefined): string {
  if (value === undefined) return "-";
  
  if (Math.abs(value) >= 1e12) {
    return (value / 1e12).toFixed(2) + "T";
  }
  if (Math.abs(value) >= 1e9) {
    return (value / 1e9).toFixed(2) + "B";
  }
  if (Math.abs(value) >= 1e6) {
    return (value / 1e6).toFixed(2) + "M";
  }
  if (Math.abs(value) >= 1e3) {
    return (value / 1e3).toFixed(2) + "K";
  }
  
  return value.toFixed(2);
}

