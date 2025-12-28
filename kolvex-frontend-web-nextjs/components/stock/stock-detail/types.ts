import type {
  APIStockQuote,
  APICompanyProfile,
  APIFinancials,
} from "@/lib/stockApi";

export interface StockQuoteData {
  quote: APIStockQuote | null;
  company: APICompanyProfile | null;
  financials: APIFinancials | null;
}

export interface TrackingState {
  isTracked: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

// Re-export types for convenience
export type { APIStockQuote, APICompanyProfile, APIFinancials };


