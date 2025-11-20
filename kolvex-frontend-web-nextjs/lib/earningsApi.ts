// Earnings Calendar API Service
// Using Finnhub API for S&P 500 earnings data

import sp500Data from "@/data/sp500.constituents.wikilogo.json";

/**
 * Finnhub API 原始响应格式
 */
export interface FinnhubEarningsItem {
  date: string; // 财报日期 "YYYY-MM-DD"
  epsActual: number | null; // 实际EPS
  epsEstimate: number | null; // 预估EPS
  hour: "bmo" | "amc" | "dmh"; // 财报时间: bmo=盘前, amc=盘后, dmh=盘中
  quarter: number; // 季度 (1-4)
  revenueActual: number | null; // 实际营收
  revenueEstimate: number | null; // 预估营收
  symbol: string; // 股票代码
  year: number; // 年份
}

/**
 * Finnhub API 响应结构
 */
export interface FinnhubEarningsResponse {
  earningsCalendar: FinnhubEarningsItem[];
}

/**
 * 财报时间类型
 */
export type EarningsTimeType = "bmo" | "amc" | "dmh";

/**
 * 分组后的财报数据（按日期）
 */
export type GroupedEarnings = Record<string, EarningsEvent[]>;

/**
 * S&P 500 公司信息
 */
export interface SP500Company {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
  headquarters: string;
  dateAdded: string;
  cik: string;
  founded: string;
  logoUrl: string | null;
  logoFile: string | null;
  wikidata: string | null;
}

/**
 * 应用内使用的财报事件接口（扩展了 Finnhub 数据）
 */
export interface EarningsEvent {
  date: string; // 财报日期 "YYYY-MM-DD"
  symbol: string; // 股票代码
  companyName: string; // 公司名称
  epsEstimate: number | null; // 预估EPS
  epsActual: number | null; // 实际EPS
  revenueEstimate: number | null; // 预估营收（单位：美元）
  revenueActual: number | null; // 实际营收（单位：美元）
  quarter?: number; // 季度 (1-4)
  year?: number; // 年份
  time?: "bmo" | "amc" | "dmh"; // 财报时间: bmo=盘前, amc=盘后, dmh=盘中
  logo?: string | null; // 公司Logo URL
  sector?: string | null; // 行业板块
  subIndustry?: string | null; // 细分行业
}

/**
 * 公司信息接口
 */
export interface CompanyProfile {
  logo: string;
  name: string;
  ticker: string;
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  phone: string;
  shareOutstanding: number;
  weburl: string;
  finnhubIndustry: string;
}

// API Keys from environment
const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || "";

// API Base URLs
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

// Cache for company profiles
const companyProfileCache = new Map<string, CompanyProfile | null>();

// 从 S&P 500 JSON 数据创建映射
const sp500Companies = sp500Data as SP500Company[];
const sp500SymbolSet = new Set(sp500Companies.map((c) => c.symbol));
const sp500NamesMap: Record<string, string> = {};
const sp500SectorMap: Record<string, string> = {};
const sp500SubIndustryMap: Record<string, string> = {};
const sp500LogoMap: Record<string, string | null> = {};

sp500Companies.forEach((company) => {
  sp500NamesMap[company.symbol] = company.name;
  sp500SectorMap[company.symbol] = company.sector;
  sp500SubIndustryMap[company.symbol] = company.subIndustry;
  sp500LogoMap[company.symbol] = company.logoUrl;
});

/**
 * Fetch company profile from Finnhub
 */
export async function fetchCompanyProfile(
  symbol: string
): Promise<CompanyProfile | null> {
  // Check cache first
  if (companyProfileCache.has(symbol)) {
    return companyProfileCache.get(symbol) || null;
  }

  if (!FINNHUB_API_KEY) {
    console.warn("⚠️ Finnhub API key not configured");
    return null;
  }

  try {
    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      console.warn(
        `Finnhub profile API returned ${response.status} for ${symbol}`
      );
      companyProfileCache.set(symbol, null);
      return null;
    }

    const data = await response.json();

    if (!data || !data.name) {
      console.warn(`No profile data for ${symbol}`);
      companyProfileCache.set(symbol, null);
      return null;
    }

    const profile: CompanyProfile = {
      logo: data.logo || "",
      name: data.name || symbol,
      ticker: data.ticker || symbol,
      country: data.country || "",
      currency: data.currency || "USD",
      exchange: data.exchange || "",
      ipo: data.ipo || "",
      marketCapitalization: data.marketCapitalization || 0,
      phone: data.phone || "",
      shareOutstanding: data.shareOutstanding || 0,
      weburl: data.weburl || "",
      finnhubIndustry: data.finnhubIndustry || "",
    };

    // Cache the result
    companyProfileCache.set(symbol, profile);
    return profile;
  } catch (error) {
    console.error(`Error fetching profile for ${symbol}:`, error);
    companyProfileCache.set(symbol, null);
    return null;
  }
}

/**
 * Fetch earnings calendar from Finnhub
 */
async function fetchFinnhubEarnings(
  from: string,
  to: string
): Promise<EarningsEvent[] | null> {
  if (!FINNHUB_API_KEY) {
    console.warn("⚠️ Finnhub API key not configured");
    return null;
  }

  try {
    const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url, {
      cache: "no-store",
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.warn(`Finnhub API returned ${response.status}`);
      return null;
    }

    const data: FinnhubEarningsResponse = await response.json();

    if (!data.earningsCalendar || data.earningsCalendar.length === 0) {
      console.warn("No earnings data from Finnhub");
      return [];
    }

    // 过滤并转换数据：只保留 S&P 500 公司的财报
    const sp500Earnings = data.earningsCalendar
      .filter((item: FinnhubEarningsItem) => sp500SymbolSet.has(item.symbol))
      .map(
        (item: FinnhubEarningsItem): EarningsEvent => ({
          date: item.date,
          symbol: item.symbol,
          companyName: sp500NamesMap[item.symbol] || item.symbol,
          time: item.hour, // 将 hour 映射到 time
          epsEstimate: item.epsEstimate,
          epsActual: item.epsActual,
          revenueEstimate: item.revenueEstimate,
          revenueActual: item.revenueActual,
          quarter: item.quarter,
          year: item.year,
          sector: sp500SectorMap[item.symbol] || null,
          subIndustry: sp500SubIndustryMap[item.symbol] || null,
          logo: sp500LogoMap[item.symbol] || null,
        })
      );

    return sp500Earnings;
  } catch (error) {
    console.error("Error fetching Finnhub earnings:", error);
    return null;
  }
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enrich earnings events with company profiles
 */
async function enrichEarningsWithProfiles(
  earnings: EarningsEvent[]
): Promise<EarningsEvent[]> {
  // Get unique symbols
  const symbols = [...new Set(earnings.map((e) => e.symbol))];

  // Limit to top 20 companies to avoid rate limiting
  const limitedSymbols = symbols.slice(0, 20);

  // console.log(`🔄 Fetching profiles for ${limitedSymbols.length} companies...`);

  // // Fetch profiles sequentially with delay to avoid rate limiting
  // for (const symbol of limitedSymbols) {
  //   await fetchCompanyProfile(symbol);
  //   // Add 200ms delay between requests to avoid 429 errors
  //   await delay(200);
  // }

  // Enrich earnings with profile data
  return earnings.map((event) => {
    const profile = companyProfileCache.get(event.symbol);
    if (profile) {
      return {
        ...event,
        logo: profile.logo,
        industry: profile.finnhubIndustry,
        marketCap: profile.marketCapitalization,
        companyName: profile.name || event.companyName,
      };
    }
    return event;
  });
}

/**
 * 获取 S&P 500 财报日历
 * @param from 开始日期 (YYYY-MM-DD)
 * @param to 结束日期 (YYYY-MM-DD)
 * @param enrichWithProfiles 是否使用公司信息扩展数据
 * @returns S&P 500 公司的财报事件列表
 */
export async function fetchEarningsCalendar(
  from?: string,
  to?: string,
  enrichWithProfiles: boolean = true
): Promise<EarningsEvent[]> {
  // Default to next 7 days if not specified
  const today = new Date();
  const defaultFrom = from || today.toISOString().split("T")[0];

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  const defaultTo = to || endDate.toISOString().split("T")[0];

  // 从 Finnhub 获取 S&P 500 财报数据
  let earnings = await fetchFinnhubEarnings(defaultFrom, defaultTo);

  if (!earnings || earnings.length === 0) {
    console.warn(
      `No S&P 500 earnings found from ${defaultFrom} to ${defaultTo}`
    );
    return [];
  }

  // Enrich with company profiles if requested
  if (enrichWithProfiles && FINNHUB_API_KEY) {
    earnings = await enrichEarningsWithProfiles(earnings);
  }

  return earnings;
}

/**
 * 获取特定股票的财报（仅限 S&P 500）
 * @param symbol 股票代码
 * @returns 该股票的财报事件列表
 */
export async function fetchSymbolEarnings(
  symbol: string
): Promise<EarningsEvent[]> {
  // 检查是否是 S&P 500 公司
  if (!sp500SymbolSet.has(symbol)) {
    console.warn(`${symbol} is not in S&P 500`);
    return [];
  }

  // 获取所有财报并过滤
  const allEarnings = await fetchEarningsCalendar();
  return allEarnings.filter((e) => e.symbol === symbol);
}

/**
 * Group earnings by date
 */
export function groupEarningsByDate(events: EarningsEvent[]): GroupedEarnings {
  return events.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, EarningsEvent[]>);
}

/**
 * Format earnings date for display
 */
export function formatEarningsDate(dateStr: string): string {
  // Parse date string as local date to avoid timezone issues
  const [year, month, day] = dateStr.split("-").map(Number);
  const earningsDate = new Date(year, month - 1, day);
  earningsDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = earningsDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;

  return earningsDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Get earnings time label
 */
export function getEarningsTimeLabel(time?: "bmo" | "amc" | "dmh"): string {
  switch (time) {
    case "bmo":
      return "Pre-Market";
    case "amc":
      return "After hours";
    default:
      return "TBD";
  }
}

/**
 * 检查股票是否在 S&P 500 中
 */
export function isInSP500(symbol: string): boolean {
  return sp500SymbolSet.has(symbol);
}

/**
 * 获取 S&P 500 公司信息
 */
export function getSP500Company(symbol: string): SP500Company | null {
  return sp500Companies.find((c) => c.symbol === symbol) || null;
}

/**
 * 获取所有 S&P 500 公司列表
 */
export function getAllSP500Companies(): SP500Company[] {
  return sp500Companies;
}

/**
 * 按行业板块获取 S&P 500 公司
 */
export function getSP500CompaniesBySector(sector: string): SP500Company[] {
  return sp500Companies.filter((c) => c.sector === sector);
}
