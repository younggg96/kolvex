/**
 * AI API 客户端
 * 调用后端 AI 分析服务
 */

// ============================================================
// 类型定义
// ============================================================

export interface SentimentResult {
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  reasoning: string;
}

export interface TweetAnalysis {
  sentiment?: SentimentResult;
  tickers?: string[];
  summary?: string;
  tags?: string[];
  analyzed_at?: string;
}

export interface GenerateRequest {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface GenerateResponse {
  response: string;
  model: string;
}

export interface HealthStatus {
  status: string;
  ollama_available: boolean;
  model: string;
  base_url: string;
}

export interface ModelInfo {
  name: string;
  size?: number;      // 字节数
  size_gb?: string;   // 格式化后的大小 (如 "39.6 GB")
  modified_at?: string;
}

// ============================================================
// API 配置
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}/api/v1/ai${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `AI API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================
// API 函数
// ============================================================

/**
 * 健康检查
 */
export async function checkAIHealth(): Promise<HealthStatus> {
  return fetchAI<HealthStatus>("/health");
}

/**
 * 获取可用模型列表
 */
export async function getModels(): Promise<{ models: ModelInfo[] }> {
  return fetchAI<{ models: ModelInfo[] }>("/models");
}

/**
 * 生成文本
 */
export async function generate(request: GenerateRequest): Promise<GenerateResponse> {
  return fetchAI<GenerateResponse>("/generate", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * 聊天补全
 */
export async function chat(request: ChatRequest): Promise<GenerateResponse> {
  return fetchAI<GenerateResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * 分析推文
 * 
 * @param tweetText - 推文文本
 * @param analysisType - 分析类型: "full" | "sentiment" | "tickers" | "tags" | "summary"
 */
export async function analyzeTweet(
  tweetText: string,
  analysisType: "full" | "sentiment" | "tickers" | "tags" | "summary" = "full"
): Promise<TweetAnalysis> {
  return fetchAI<TweetAnalysis>("/analyze-tweet", {
    method: "POST",
    body: JSON.stringify({
      tweet_text: tweetText,
      analysis_type: analysisType,
    }),
  });
}

/**
 * 批量分析推文
 */
export async function batchAnalyzeTweets(
  tweets: string[],
  analysisType: "sentiment" | "tickers" | "tags" | "full" = "sentiment"
): Promise<{
  results: Array<{
    tweet: string;
    result?: TweetAnalysis | SentimentResult | string[];
    error?: string;
    success: boolean;
  }>;
  total: number;
}> {
  const params = new URLSearchParams({ analysis_type: analysisType });
  return fetchAI(`/batch-analyze?${params}`, {
    method: "POST",
    body: JSON.stringify(tweets),
  });
}

// ============================================================
// 便捷函数
// ============================================================

/**
 * 快速获取情感分析
 */
export async function getSentiment(tweetText: string): Promise<SentimentResult | null> {
  try {
    const result = await analyzeTweet(tweetText, "sentiment");
    return result.sentiment || null;
  } catch {
    return null;
  }
}

/**
 * 快速提取股票代码
 */
export async function extractTickers(tweetText: string): Promise<string[]> {
  try {
    const result = await analyzeTweet(tweetText, "tickers");
    return result.tickers || [];
  } catch {
    return [];
  }
}

/**
 * 快速生成标签
 */
export async function generateTags(tweetText: string): Promise<string[]> {
  try {
    const result = await analyzeTweet(tweetText, "tags");
    return result.tags || [];
  } catch {
    return [];
  }
}

/**
 * 快速生成摘要
 */
export async function summarizeTweet(tweetText: string): Promise<string> {
  try {
    const result = await analyzeTweet(tweetText, "summary");
    return result.summary || tweetText;
  } catch {
    return tweetText;
  }
}

// ============================================================
// 情感颜色/图标辅助
// ============================================================

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "bullish":
      return "text-green-500";
    case "bearish":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

export function getSentimentBgColor(sentiment: string): string {
  switch (sentiment) {
    case "bullish":
      return "bg-green-500/10";
    case "bearish":
      return "bg-red-500/10";
    default:
      return "bg-gray-500/10";
  }
}

export function getSentimentIcon(sentiment: string): string {
  switch (sentiment) {
    case "bullish":
      return "📈";
    case "bearish":
      return "📉";
    default:
      return "➖";
  }
}

export function getSentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case "bullish":
      return "看涨";
    case "bearish":
      return "看跌";
    default:
      return "中性";
  }
}

