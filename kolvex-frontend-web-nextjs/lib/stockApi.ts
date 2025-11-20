// Stock API Service
// Using multiple free APIs for redundancy and better data coverage

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  marketCap?: number;
  timestamp?: string;
}

export interface MarketIndex {
  name: string;
  value: string;
  change: number;
  changePercent: number;
  chartData?: number[];
}

export interface ChartData {
  time: string;
  value: number;
}

// Yahoo Finance API (unofficial but reliable)
const YAHOO_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

// Alternative: Twelve Data API (free tier available)
const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";

// Alpha Vantage API (requires free API key)
const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";
const ALPHA_VANTAGE_API_KEY =
  process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || "demo";

// Finnhub API (requires free API key)
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || "";

// Stock symbols mapping
const STOCK_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  GOOGL: "Alphabet Inc.",
  MSFT: "Microsoft Corp.",
  TSLA: "Tesla, Inc.",
  AMZN: "Amazon.com, Inc.",
  NVDA: "NVIDIA Corp.",
  META: "Meta Platforms, Inc.",
  NFLX: "Netflix, Inc.",
};

// Market indices mapping
const INDEX_SYMBOLS: Record<string, string> = {
  "Dow Jones": "^DJI",
  NASDAQ: "^IXIC",
  "S&P 500": "^GSPC",
};

/**
 * Fetch stock quote using Yahoo Finance API
 */
async function fetchYahooQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const url = `${YAHOO_BASE_URL}/${symbol}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`Yahoo API returned ${response.status} for ${symbol}`);
      return null;
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]?.meta) {
      console.warn(`Invalid Yahoo API response for ${symbol}`);
      return null;
    }

    const quote = data.chart.result[0].meta;
    const price = quote.regularMarketPrice || quote.chartPreviousClose;
    const previousClose = quote.previousClose || quote.chartPreviousClose;

    if (!price || !previousClose) {
      console.warn(`Missing price data from Yahoo for ${symbol}`);
      return null;
    }

    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol: symbol,
      name: STOCK_NAMES[symbol] || quote.longName || symbol,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: quote.regularMarketVolume,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      previousClose,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching Yahoo quote for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch stock quote using Alpha Vantage API
 */
async function fetchAlphaVantageQuote(
  symbol: string
): Promise<StockQuote | null> {
  try {
    const response = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    if (!response.ok) return null;

    const data = await response.json();
    const quote = data["Global Quote"];

    if (!quote || Object.keys(quote).length === 0) return null;

    const price = parseFloat(quote["05. price"]);
    const change = parseFloat(quote["09. change"]);
    const changePercent = parseFloat(
      quote["10. change percent"].replace("%", "")
    );

    return {
      symbol: symbol,
      name: STOCK_NAMES[symbol] || symbol,
      price,
      change,
      changePercent,
      volume: parseInt(quote["06. volume"]),
      high: parseFloat(quote["03. high"]),
      low: parseFloat(quote["04. low"]),
      previousClose: parseFloat(quote["08. previous close"]),
      timestamp: quote["07. latest trading day"],
    };
  } catch (error) {
    console.error(`Error fetching Alpha Vantage quote for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch stock quote using Finnhub API
 */
async function fetchFinnhubQuote(symbol: string): Promise<StockQuote | null> {
  if (!FINNHUB_API_KEY) return null;

  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );
    if (!response.ok) return null;

    const data = await response.json();

    return {
      symbol: symbol,
      name: STOCK_NAMES[symbol] || symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      previousClose: data.pc,
      timestamp: new Date(data.t * 1000).toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching Finnhub quote for ${symbol}:`, error);
    return null;
  }
}

/**
 * Main function to fetch stock quote with fallbacks
 */
export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  // Try Yahoo Finance first (no API key required)
  let quote = await fetchYahooQuote(symbol);
  if (quote) {
    return quote;
  }

  // Try Finnhub as fallback
  quote = await fetchFinnhubQuote(symbol);
  if (quote) {
    return quote;
  }

  // Try Alpha Vantage as last resort
  quote = await fetchAlphaVantageQuote(symbol);
  if (quote) {
    return quote;
  }

  // All APIs failed
  throw new Error(
    `Failed to fetch stock quote for ${symbol} from all available APIs`
  );
}

/**
 * Fetch multiple stock quotes
 * Returns only successfully fetched quotes, skips failed ones
 */
export async function fetchMultipleQuotes(
  symbols: string[]
): Promise<StockQuote[]> {
  const promises = symbols.map(async (symbol) => {
    try {
      return await fetchStockQuote(symbol);
    } catch (error) {
      console.error(`Failed to fetch quote for ${symbol}:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((quote): quote is StockQuote => quote !== null);
}

/**
 * Fetch market indices with chart data
 * Returns only successfully fetched indices, skips failed ones
 */
// export async function fetchMarketIndices(): Promise<MarketIndex[]> {
//   const indices = Object.entries(INDEX_SYMBOLS);
//   const promises = indices.map(async ([name, symbol]) => {
//     try {
//       // Fetch both quote and intraday chart data
//       const [quote, chartData] = await Promise.all([
//         fetchStockQuote(symbol),
//         fetchChartData(symbol, "15m", "1d").catch(() => []),
//       ]);

//       // Extract prices for sparkline (last 20 points)
//       const prices = chartData.slice(-20).map((d) => d.value);

//       return {
//         name,
//         value: quote.price.toLocaleString("en-US", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         }),
//         change: quote.change,
//         changePercent: quote.changePercent,
//         chartData: prices.length > 0 ? prices : undefined,
//       };
//     } catch (error) {
//       console.error(`Failed to fetch index ${name}:`, error);
//       return null;
//     }
//   });

//   const results = await Promise.all(promises);
//   return results.filter((index): index is MarketIndex => index !== null);
// }

/**
 * Fetch intraday chart data using Yahoo Finance API
 */
export async function fetchChartData(
  symbol: string,
  interval: string = "5m",
  range: string = "1d"
): Promise<ChartData[]> {
  try {
    const url = `${YAHOO_BASE_URL}/${symbol}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Yahoo API returned ${response.status} for ${symbol}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      throw new Error(`Invalid Yahoo API response for ${symbol}`);
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const prices = result.indicators?.quote?.[0]?.close || [];

    if (timestamps.length === 0 || prices.length === 0) {
      throw new Error(`No chart data available for ${symbol}`);
    }

    const chartData: ChartData[] = timestamps
      .map((ts: number, index: number) => {
        const date = new Date(ts * 1000);
        const time = date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        return {
          time,
          value: prices[index] || 0,
        };
      })
      .filter((item: ChartData) => item.value > 0); // Filter out null/zero values

    return chartData;
  } catch (error) {
    console.error(`Error fetching chart data for ${symbol}:`, error);
    throw new Error(`Failed to fetch chart data for ${symbol}`);
  }
}
