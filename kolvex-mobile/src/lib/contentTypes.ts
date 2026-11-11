export interface BriefImage {
  url: string;
  caption: string;
  credit: string;
  source_page: string;
}
export interface BriefItem {
  title: string;
  summary: string;
  kicker: string;
  key_stats: { label: string; value: string | number }[];
  image?: BriefImage | null;
  sources: { name: string; url: string }[];
  related_tickers: string[];
  impact?: {
    short_term: string;
    long_term: string;
    price_range: string;
    positioning: string;
  } | null;
  time_pt: string;
  detail: string;
  checklist: string[];
}
export interface BriefSection {
  section_id: string;
  order: number;
  title: string;
  subtitle: string;
  narrative: string | string[];
  paragraphs: string[];
  indices: {
    name: string;
    prev_close: number | null;
    close: number | null;
    change_pct: number | null;
    note: string | null;
  }[];
  movers_up: { name: string; detail: string }[];
  movers_down: { name: string; detail: string }[];
  commodities: { name: string; detail: string }[];
  items: BriefItem[];
  takeaway: string;
  strategy_line: string;
  events: { date_label: string; title: string; detail: string }[];
}
export const BRIEF_TYPES = ["morning", "intraday", "evening"] as const;
export type BriefType = (typeof BRIEF_TYPES)[number];
export function isBriefType(value?: string): value is BriefType {
  return BRIEF_TYPES.some((type) => type === value);
}

export type BriefLanguage = "zh" | "en";
export interface LocalizedBrief {
  title: string;
  headline: string;
  subtitle?: string;
  sections: BriefSection[];
  disclaimer?: string;
  hero_image?: BriefImage | null;
}
export interface DailyBrief {
  schema_version: "kolvex-brief/1.0";
  language?: BriefLanguage;
  translations?: Partial<Record<BriefLanguage, LocalizedBrief>>;
  brief: {
    id: string;
    type: BriefType;
    date: string;
    title: string;
    headline: string;
    subtitle: string;
    generated_at_pt: string;
    market_status: "trading_day" | "weekend";
    hero_image?: BriefImage | null;
  };
  sections: BriefSection[];
  disclaimer?: string;
}

export interface BriefSummary {
  id: string;
  brief_date: string;
  brief_type: BriefType;
  title: string;
  headline: string;
  summary?: DailyBrief["brief"];
}

export interface XCreator {
  username: string;
  display_name: string;
  bio: string;
  avatar_url?: string | null;
  location?: string | null;
  website?: string | null;
  followers_count?: number | null;
  following_count?: number | null;
}
export interface XPost {
  id: string;
  author_username: string;
  url: string;
  published_at: string;
  text: string;
  cashtags: string[];
  metrics: Record<string, number | null>;
  quoted_texts: string[];
  media_links: string[];
  truncated: boolean;
  pinned: boolean;
  creator: XCreator | null;
}
export interface XFeed {
  posts: XPost[];
  total: number;
  limit: number;
  offset: number;
}

export interface AnalysisAuthor {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface TradingAnalysis {
  id: string;
  user_id?: string;
  ticker: string;
  trade_date: string;
  status: "pending" | "running" | "completed" | "failed";
  selected_analysts: string[];
  llm_provider: string | null;
  deep_think_model?: string | null;
  quick_think_model?: string | null;
  market_report?: string | null;
  sentiment_report?: string | null;
  news_report?: string | null;
  fundamentals_report?: string | null;
  investment_debate?: InvestmentDebate | null;
  investment_plan?: string | null;
  trader_plan?: string | null;
  risk_debate?: RiskDebate | null;
  final_decision?: string | null;
  full_signal?: string | null;
  error_message?: string | null;
  progress_stage?: string | null;
  progress_message?: string | null;
  progress_events?: AnalysisProgressEvent[] | null;
  duration_seconds?: number | null;
  is_published?: boolean;
  published_at?: string | null;
  created_at: string;
  completed_at?: string | null;
  author?: AnalysisAuthor | null;
}

export interface InvestmentDebate {
  bull_history: string;
  bear_history: string;
  history: string;
  current_response: string;
  judge_decision: string;
}

export interface RiskDebate {
  aggressive_history: string;
  conservative_history: string;
  neutral_history: string;
  history: string;
  judge_decision: string;
}

export interface TradingAnalysisListResponse {
  items: TradingAnalysis[];
  total: number;
  limit: number;
  offset: number;
}

export type NewsItem = {
  id?: string;
  uuid?: string;
  title: string;
  publisher: string | null;
  link: string;
  publish_time: number | null;
  summary?: string;
  title_zh?: string;
};
export type NewsFeed = {
  articles: NewsItem[];
  fetched_at: string;
  stale: boolean;
  source: string;
  delivery: string;
};
export type Position = {
  id: string;
  symbol: string;
  security_name?: string;
  units: number;
  price?: number;
  market_value?: number;
  open_pnl?: number;
  currency?: string;
  position_type?: string;
  underlying_symbol?: string;
  option_type?: string;
  strike_price?: number;
  expiration_date?: string;
};
export type Holdings = {
  is_connected: boolean;
  last_synced_at?: string;
  total_value?: number | string;
  accounts: {
    id: string;
    account_name?: string;
    brokerage_name?: string;
    portfolio_positions?: Position[];
  }[];
};
export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};
/** A research task's progress record (the Web's tradingAnalysisApi ProgressEvent). */
export interface AnalysisProgressEvent {
  stage: string;
  message?: string;
  node?: string;
  elapsed?: number;
  status?: string;
  decision?: string;
  final_decision?: string;
  error_message?: string;
  detail?: string;
  detail_type?: "tool_call" | "tool_result" | "thinking" | "report_preview";
}
export type ProgressEvent = {
  type: string;
  content?: string;
  tool?: string;
  stage?: string;
  message_id?: string;
  created_at?: string;
};
export type Profile = {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  membership: string;
  is_admin?: boolean;
  avatar_url?: string;
  phone_e164?: string;
  theme?: string;
  locale?: string;
};

export const briefNames: Record<string, string> = {
  morning: "盘前",
  intraday: "盘中",
  evening: "盘后",
};

export function localizedBrief(
  document: DailyBrief,
  locale: BriefLanguage,
): DailyBrief {
  const language = document.language ?? "zh";
  const copy =
    locale !== language ? document.translations?.[locale] : undefined;
  if (!copy) return document;
  return {
    ...document,
    language: locale,
    brief: {
      ...document.brief,
      title: copy.title,
      headline: copy.headline,
      subtitle: copy.subtitle ?? "",
      hero_image: copy.hero_image ?? document.brief.hero_image,
    },
    sections: copy.sections,
    disclaimer: copy.disclaimer ?? "",
  };
}
