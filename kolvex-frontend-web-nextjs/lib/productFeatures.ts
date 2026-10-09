export type ProductFeatureId =
  | "home"
  | "journal"
  | "chat"
  | "tradingAnalysis"
  | "youtubeOpinions"
  | "portfolio"
  | "settings"
  | "admin";

export interface ProductFeature {
  id: ProductFeatureId;
  label: string;
  enabled: boolean;
  routePrefixes: readonly string[];
  apiPrefixes?: readonly string[];
  componentDirs?: readonly string[];
  libFiles?: readonly string[];
}

export const PRODUCT_FEATURES = [
  { id: "home", label: "Markets", enabled: true, routePrefixes: ["/dashboard", "/dashboard/market"] },
  { id: "journal", label: "Updates", enabled: true, routePrefixes: ["/dashboard/journal"], apiPrefixes: ["/api/theses"] },
  {
    id: "chat",
    label: "AI Chat",
    enabled: true,
    routePrefixes: ["/dashboard/chat"],
    apiPrefixes: ["/api/chat", "/api/chat-history"],
    componentDirs: ["components/chat"],
    libFiles: ["lib/chatApi.ts"],
  },
  {
    id: "tradingAnalysis",
    label: "AI Research",
    enabled: true,
    routePrefixes: ["/dashboard/ai-research", "/dashboard/research/deep-research", "/dashboard/trading-analysis"],
    apiPrefixes: ["/api/trading-analysis"],
    componentDirs: ["components/trading-analysis"],
    libFiles: ["lib/tradingAnalysisApi.ts"],
  },
  {
    id: "youtubeOpinions",
    label: "YouTube Opinions",
    enabled: true,
    routePrefixes: ["/dashboard/youtube-opinions"],
    apiPrefixes: ["/api/youtube-opinions"],
    libFiles: ["lib/youtubeOpinionsApi.ts"],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    enabled: true,
    routePrefixes: ["/dashboard/portfolio"],
    apiPrefixes: [
      "/api/portfolio",
      "/api/plaid",
      "/api/stocks",
    ],
    componentDirs: ["components/portfolio"],
    libFiles: [
      "lib/portfolioApi.ts",
      "lib/plaidApi.ts",
      "lib/stockApi.ts",
      "lib/stockApi.server.ts",
    ],
  },
  {
    id: "settings",
    label: "Settings",
    enabled: true,
    routePrefixes: ["/dashboard/settings", "/config"],
    apiPrefixes: ["/api/user-api-keys", "/api/upload/avatar"],
    componentDirs: ["components/user"],
  },
  {
    id: "admin",
    label: "Admin",
    enabled: true,
    routePrefixes: ["/dashboard/admin"],
    apiPrefixes: ["/api/admin"],
  },
] as const satisfies readonly ProductFeature[];

export const RETIRED_PRODUCT_ROUTE_PREFIXES = [
  "/community",
  "/dashboard/alerts",
  "/dashboard/analytics",
  "/dashboard/investors",
  "/dashboard/kol",
  "/dashboard/news",
  "/dashboard/notifications",
  "/dashboard/options-flow",
  "/dashboard/social",
  "/dashboard/stock",
  "/dashboard/stock-screener",
  "/dashboard/stocks",
] as const;

export const DISABLED_PRODUCT_ROUTE_PREFIXES = RETIRED_PRODUCT_ROUTE_PREFIXES;

export const DISABLED_PRODUCT_REDIRECT = "/dashboard";

export function isProductRouteDisabled(pathname: string): boolean {
  return DISABLED_PRODUCT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isProductFeatureEnabled(featureId: ProductFeatureId): boolean {
  return PRODUCT_FEATURES.find((feature) => feature.id === featureId)?.enabled ?? false;
}
