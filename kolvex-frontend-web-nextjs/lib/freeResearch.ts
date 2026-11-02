export interface Filing {
  form: string; accession: string; filed: string; period: string;
  description: string; source_url: string;
}
export interface SecMeta { name: string; cik: number; fetched_at: string; source: string }
export interface FinancialRow {
  start: string; period: string;
  revenue?: number | null; gross_profit?: number | null; operating_income?: number | null;
  net_income?: number | null; eps_diluted?: number | null; operating_cash_flow?: number | null;
  capex?: number | null; free_cash_flow?: number | null; assets?: number | null;
  liabilities?: number | null; equity?: number | null; gross_margin?: number | null;
  operating_margin?: number | null; net_margin?: number | null;
  sources: Record<string, { source_url?: string; derived: boolean; inputs?: string[] }>;
}
export interface SecFinancials extends SecMeta { currency: string | null; annual: FinancialRow[]; quarterly: FinancialRow[]; ttm: FinancialRow | null }
export interface SecFilings extends SecMeta { filings: Filing[] }
export interface InsiderTransaction {
  owner: string; position: string; security: string | null; date: string | null; filed: string;
  code: string | null; direction: string | null; shares: number | null; price: number | null;
  value: number | null; shares_after: number | null; ownership: string | null; amended: boolean; source_url: string;
}
export interface SecInsiders extends SecMeta { transactions: InsiderTransaction[]; filings: Filing[]; failed_filings: number; filing_limit: number }
export interface Institution extends SecMeta {
  filing: Filing | null; previous_filing: Filing | null; partial: boolean; amendments: Filing[];
  holdings: { issuer: string; class: string; cusip: string; put_call: string | null; share_type: string | null;
    shares: number | null; value: number | null; weight: number | null; change: number | null;
    change_percent: number | null; previous_shares: number | null;
    activity: "unknown" | "new" | "increased" | "reduced" | "unchanged" | "exited" }[];
}
export interface RevenueOutlook {
  currency: string | null; estimates: { period: string; average: number | null; low: number | null;
    high: number | null; analysts: number | null; year_ago: number | null; growth: number | null }[];
}
export const freeResearchKey = (symbol: string, kind: "financials" | "filings" | "insiders" | "revenue-outlook") => `/api/market/free-research/${encodeURIComponent(symbol)}/${kind}`;
export function secSourceUrl(value: string | undefined): string | undefined {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && url.hostname === "www.sec.gov" && url.pathname.startsWith("/Archives/edgar/data/") && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
