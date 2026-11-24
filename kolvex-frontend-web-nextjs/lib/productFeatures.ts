export type ProductFeatureId =
  | "home"
  | "watchlist"
  | "journal"
  | "chat"
  | "tradingAnalysis"
  | "youtubeOpinions"
  | "personUpdates"
  | "briefs"
  | "news"
  | "portfolio"
  | "paperTrading"
  | "superinvestors"
  | "congressTrades"
  | "optionsActivity"
  | "tradeOS"
  | "marketRisk"
  | "settings"
  | "admin";

export interface ProductFeature {
  id: ProductFeatureId;
  label: string;
  enabled: boolean;
  experimental?: boolean;
  routePrefixes: readonly string[];
  apiPrefixes?: readonly string[];
  componentDirs?: readonly string[];
  libFiles?: readonly string[];
}

export const PRODUCT_FEATURES = [
  {
    id: "tradeOS",
    label: "Trade OS (Experimental)",
    enabled: true,
    experimental: true,
    routePrefixes: ["/dashboard/trade-os"],
    apiPrefixes: ["/api/trade-os"],
    componentDirs: ["components/trade-os"],
    libFiles: ["lib/tradeOsApi.ts"],
  },
  {
    id: "marketRisk",
    label: "Market risk (Experimental)",
    enabled: true,
    experimental: true,
    routePrefixes: ["/dashboard/market-risk"],
    apiPrefixes: ["/api/market-risk"],
    componentDirs: ["components/market-risk"],
    libFiles: ["lib/marketRisk.ts"],
  },
  {
    id: "paperTrading",
    label: "Paper trading",
    enabled: true,
    routePrefixes: ["/dashboard/paper-trading"],
    apiPrefixes: ["/api/paper-trading"],
  },
  {
    id: "superinvestors",
    label: "Superinvestors",
    enabled: true,
    routePrefixes: ["/dashboard/superinvestors"],
    componentDirs: ["components/superinvestors"],
  },
  {
    id: "congressTrades",
    label: "Congress trades",
    enabled: true,
    routePrefixes: ["/dashboard/congress-trades"],
    apiPrefixes: ["/api/congress/trades"],
    componentDirs: ["components/congress"],
  },
  {
    id: "optionsActivity",
    label: "Options activity",
    enabled: true,
    routePrefixes: ["/dashboard/options-activity"],
    apiPrefixes: ["/api/market/options-activity"],
    componentDirs: ["components/options-activity"],
    libFiles: ["lib/optionsActivity.ts"],
  },
  { id: "watchlist", label: "Watchlist", enabled: true, routePrefixes: ["/dashboard/watchlist"] },
  {
    id: "news",
    label: "News",
    enabled: true,
    routePrefixes: ["/dashboard/news"],
    apiPrefixes: ["/api/news"],
    componentDirs: ["components/news"],
    libFiles: ["lib/newsFeed.ts"],
  },
  {
    id: "home",
    label: "Markets",
    enabled: true,
    routePrefixes: ["/dashboard", "/dashboard/market", "/dashboard/chart"],
  },
  {
    id: "journal",
    label: "Updates",
    enabled: true,
    routePrefixes: ["/dashboard/journal"],
    apiPrefixes: ["/api/theses"],
  },
  {
    id: "chat",
    label: "AI Chat",
    enabled: true,
    routePrefixes: ["/dashboard/chat", "/dashboard/workspaces"],
    apiPrefixes: ["/api/chat", "/api/chat-history", "/api/research-workspaces"],
    componentDirs: ["components/chat"],
    libFiles: ["lib/chatApi.ts", "lib/researchWorkspaceApi.ts"],
  },
  {
    id: "tradingAnalysis",
    label: "AI Research",
    enabled: true,
    routePrefixes: [
      "/dashboard/ai-research",
      "/dashboard/research/deep-research",
      "/dashboard/trading-analysis",
    ],
    apiPrefixes: ["/api/trading-analysis"],
    componentDirs: ["components/trading-analysis"],
    libFiles: ["lib/tradingAnalysisApi.ts"],
  },
  {
    id: "youtubeOpinions",
    label: "Creator Opinions",
    enabled: true,
    routePrefixes: [
      "/dashboard/youtube-opinions",
      "/dashboard/reddit-opinions",
      "/dashboard/x-opinions",
      "/dashboard/xhs-sentiment",
    ],
    apiPrefixes: [
      "/api/youtube-opinions",
      "/api/reddit-opinions",
      "/api/x-content",
      "/api/xhs-sentiment",
      "/api/admin/xhs-sentiment",
    ],
    componentDirs: ["components/xhs"],
    libFiles: ["lib/youtubeOpinionsApi.ts", "lib/xContentApi.ts", "lib/xhsSentiment.ts"],
  },
  {
    id: "personUpdates",
    label: "Updates",
    enabled: true,
    routePrefixes: ["/tracker", "/dashboard/person-updates"],
    apiPrefixes: ["/api/person-updates", "/api/admin/person-updates"],
    componentDirs: ["components/person-updates"],
    libFiles: ["lib/personUpdates.ts"],
  },
  {
    id: "briefs",
    label: "Daily Briefs",
    enabled: true,
    routePrefixes: ["/dashboard/briefs"],
    apiPrefixes: ["/api/briefs"],
    componentDirs: ["components/briefs"],
    libFiles: ["lib/dailyBriefs.ts"],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    enabled: true,
    routePrefixes: ["/dashboard/portfolio", "/portfolio"],
    apiPrefixes: ["/api/portfolio", "/api/plaid", "/api/stocks"],
    componentDirs: ["components/portfolio"],
    libFiles: ["lib/portfolioApi.ts", "lib/plaidApi.ts", "lib/stockApi.ts"],
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
  "/dashboard/notifications",
  "/dashboard/options-flow",
  "/dashboard/social",
  "/dashboard/stock",
  "/dashboard/stock-screener",
  "/dashboard/stocks",
] as const;

export const DISABLED_PRODUCT_ROUTE_PREFIXES: readonly string[] = [
  ...RETIRED_PRODUCT_ROUTE_PREFIXES,
  ...PRODUCT_FEATURES.filter((feature) => !feature.enabled).flatMap((feature) => [
    ...feature.routePrefixes,
  ]),
];

export const DISABLED_PRODUCT_REDIRECT = "/dashboard";

export function isProductRouteDisabled(pathname: string): boolean {
  return DISABLED_PRODUCT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isProductFeatureEnabled(featureId: ProductFeatureId): boolean {
  return PRODUCT_FEATURES.find((feature) => feature.id === featureId)?.enabled ?? false;
}
