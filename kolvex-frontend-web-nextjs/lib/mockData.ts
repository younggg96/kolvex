// Mock数据中心 - 用于所有API的模拟数据

export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";

export interface Creator {
  id: string;
  platform: Platform;
  creator_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  verified: boolean;
  category: string | null;
  influence_score: number;
  total_posts_count: number;
  avg_engagement_rate: number;
  last_post_at: string | null;
  trending_score: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  post_id: string;
  platform: Platform;
  creator_id: string;
  content: string;
  content_url: string;
  published_at: string;
  media_urls: string[] | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  ai_summary: string | null;
  ai_sentiment: "negative" | "neutral" | "positive" | null;
  ai_tags: string[] | null;
  is_market_related: boolean | null;
  platform_metadata: any;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrendingTicker {
  id: string;
  ticker: string;
  company_name: string;
  platform: Platform;
  trending_score: number;
  sentiment_score: number;
  mention_count: number;
  engagement_score: number;
  price_change_24h: number | null;
  last_seen_at: string;
  first_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface TrendingTopic {
  id: string;
  topic: string;
  topic_type: string;
  platform: Platform;
  trending_score: number;
  engagement_score: number;
  mention_count: number;
  related_tickers: string[] | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

// Mock Creators Data
export const mockCreators: Creator[] = [
  {
    id: "creator-1",
    platform: "TWITTER",
    creator_id: "elonmusk",
    username: "elonmusk",
    display_name: "Elon Musk",
    avatar_url: "https://i.pravatar.cc/150?img=1",
    bio: "Tesla CEO, SpaceX founder",
    followers_count: 180000000,
    verified: true,
    category: "Tech",
    influence_score: 98,
    total_posts_count: 25000,
    avg_engagement_rate: 15.5,
    last_post_at: new Date().toISOString(),
    trending_score: 95,
    metadata: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "creator-2",
    platform: "TWITTER",
    creator_id: "cathiedwood",
    username: "cathiedwood",
    display_name: "Cathie Wood",
    avatar_url: "https://i.pravatar.cc/150?img=2",
    bio: "ARK Invest CEO",
    followers_count: 3500000,
    verified: true,
    category: "Finance",
    influence_score: 92,
    total_posts_count: 8500,
    avg_engagement_rate: 12.3,
    last_post_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    trending_score: 88,
    metadata: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "creator-3",
    platform: "REDDIT",
    creator_id: "DeepFuckingValue",
    username: "DeepFuckingValue",
    display_name: "DeepFuckingValue",
    avatar_url: "https://i.pravatar.cc/150?img=3",
    bio: "GME to the moon",
    followers_count: 500000,
    verified: false,
    category: "Trading",
    influence_score: 85,
    total_posts_count: 1200,
    avg_engagement_rate: 18.7,
    last_post_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    trending_score: 80,
    metadata: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "creator-4",
    platform: "YOUTUBE",
    creator_id: "MeetKevin",
    username: "MeetKevin",
    display_name: "Meet Kevin",
    avatar_url: "https://i.pravatar.cc/150?img=4",
    bio: "Real Estate & Stock Market Analysis",
    followers_count: 1800000,
    verified: true,
    category: "Finance",
    influence_score: 87,
    total_posts_count: 3500,
    avg_engagement_rate: 10.2,
    last_post_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    trending_score: 82,
    metadata: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "creator-5",
    platform: "REDNOTE",
    creator_id: "investing_guru",
    username: "investing_guru",
    display_name: "投资大师",
    avatar_url: "https://i.pravatar.cc/150?img=5",
    bio: "专注美股投资分析",
    followers_count: 850000,
    verified: true,
    category: "Finance",
    influence_score: 84,
    total_posts_count: 2100,
    avg_engagement_rate: 14.8,
    last_post_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    trending_score: 79,
    metadata: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  },
];

// Mock Social Posts Data
export const mockSocialPosts: SocialPost[] = [
  {
    post_id: "tweet-1",
    platform: "TWITTER",
    creator_id: "elonmusk",
    content: "Tesla Q4 earnings exceed expectations! Production ramping up significantly. $TSLA 🚀",
    content_url: "https://twitter.com/elonmusk/status/123456789",
    published_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    media_urls: ["https://via.placeholder.com/600x400"],
    likes_count: 285000,
    comments_count: 12500,
    shares_count: 45000,
    ai_summary: "Tesla Q4 earnings beat estimates with strong production growth",
    ai_sentiment: "positive",
    ai_tags: ["$TSLA", "earnings", "production"],
    is_market_related: true,
    platform_metadata: {},
    title: null,
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    post_id: "tweet-2",
    platform: "TWITTER",
    creator_id: "cathiedwood",
    content: "AI revolution is accelerating faster than expected. $NVDA $AMD continue to lead innovation in chip space.",
    content_url: "https://twitter.com/cathiedwood/status/123456790",
    published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    media_urls: null,
    likes_count: 45000,
    comments_count: 2300,
    shares_count: 8900,
    ai_summary: "ARK CEO highlights AI acceleration and chip leader performance",
    ai_sentiment: "positive",
    ai_tags: ["$NVDA", "$AMD", "AI", "chips"],
    is_market_related: true,
    platform_metadata: {},
    title: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    post_id: "reddit-1",
    platform: "REDDIT",
    creator_id: "DeepFuckingValue",
    content: "YOLO Update: Still holding 💎🙌 $GME\n\nThe fundamentals haven't changed. Short interest still high. This is a long play.",
    content_url: "https://reddit.com/r/wallstreetbets/comments/abc123",
    published_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    media_urls: ["https://via.placeholder.com/800x600"],
    likes_count: 125000,
    comments_count: 8500,
    shares_count: 15000,
    ai_summary: "Retail investor maintains GameStop position despite volatility",
    ai_sentiment: "positive",
    ai_tags: ["$GME", "diamond hands", "short squeeze"],
    is_market_related: true,
    platform_metadata: { subreddit: "wallstreetbets" },
    title: "YOLO Update: Still holding",
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    post_id: "youtube-1",
    platform: "YOUTUBE",
    creator_id: "MeetKevin",
    content: "Fed's Next Move: Rate Cut Analysis & Market Impact\n\nDetailed analysis of the Federal Reserve's latest decision and what it means for your investments.",
    content_url: "https://youtube.com/watch?v=xyz789",
    published_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    media_urls: ["https://via.placeholder.com/1280x720"],
    likes_count: 15000,
    comments_count: 2100,
    shares_count: 3500,
    ai_summary: "Federal Reserve rate decision analysis and market implications",
    ai_sentiment: "neutral",
    ai_tags: ["Fed", "interest rates", "market analysis"],
    is_market_related: true,
    platform_metadata: { duration_seconds: 1245, view_count: 450000 },
    title: "Fed's Next Move: Rate Cut Analysis & Market Impact",
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    post_id: "rednote-1",
    platform: "REDNOTE",
    creator_id: "investing_guru",
    content: "苹果新品发布会总结\n\n新iPhone销量预期强劲，供应链数据显示订单量超预期。$AAPL 值得关注！",
    content_url: "https://rednote.com/note/abc123",
    published_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    media_urls: ["https://via.placeholder.com/600x800", "https://via.placeholder.com/600x800"],
    likes_count: 28000,
    comments_count: 1800,
    shares_count: 4500,
    ai_summary: "Apple product launch shows strong sales expectations from supply chain data",
    ai_sentiment: "positive",
    ai_tags: ["$AAPL", "iPhone", "产品发布"],
    is_market_related: true,
    platform_metadata: {},
    title: "苹果新品发布会总结",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Add more varied posts
  {
    post_id: "tweet-3",
    platform: "TWITTER",
    creator_id: "elonmusk",
    content: "SpaceX Starship launch successful! Historic moment for space exploration. Next stop: Mars! 🚀🔴",
    content_url: "https://twitter.com/elonmusk/status/123456791",
    published_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    media_urls: ["https://via.placeholder.com/800x600"],
    likes_count: 520000,
    comments_count: 35000,
    shares_count: 95000,
    ai_summary: "SpaceX achieves successful Starship launch milestone",
    ai_sentiment: "positive",
    ai_tags: ["SpaceX", "Starship", "Mars"],
    is_market_related: false,
    platform_metadata: {},
    title: null,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    post_id: "reddit-2",
    platform: "REDDIT",
    creator_id: "DeepFuckingValue",
    content: "Market Analysis: Tech Sector Outlook\n\nLooking at the current valuations and future growth potential. $MSFT $GOOGL $META all showing strong fundamentals.",
    content_url: "https://reddit.com/r/wallstreetbets/comments/def456",
    published_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    media_urls: null,
    likes_count: 42000,
    comments_count: 3200,
    shares_count: 6700,
    ai_summary: "Technical analysis of major tech stocks shows positive outlook",
    ai_sentiment: "positive",
    ai_tags: ["$MSFT", "$GOOGL", "$META", "tech analysis"],
    is_market_related: true,
    platform_metadata: { subreddit: "wallstreetbets" },
    title: "Market Analysis: Tech Sector Outlook",
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock Trending Tickers Data
export const mockTrendingTickers: TrendingTicker[] = [
  {
    id: "ticker-1",
    ticker: "TSLA",
    company_name: "Tesla, Inc.",
    platform: "TWITTER",
    trending_score: 95,
    sentiment_score: 8.5,
    mention_count: 15420,
    engagement_score: 92,
    price_change_24h: 3.45,
    last_seen_at: new Date().toISOString(),
    first_seen_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "ticker-2",
    ticker: "NVDA",
    company_name: "NVIDIA Corporation",
    platform: "TWITTER",
    trending_score: 93,
    sentiment_score: 9.2,
    mention_count: 12850,
    engagement_score: 95,
    price_change_24h: 5.67,
    last_seen_at: new Date().toISOString(),
    first_seen_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "ticker-3",
    ticker: "AAPL",
    company_name: "Apple Inc.",
    platform: "REDNOTE",
    trending_score: 88,
    sentiment_score: 7.8,
    mention_count: 9540,
    engagement_score: 87,
    price_change_24h: 1.23,
    last_seen_at: new Date().toISOString(),
    first_seen_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "ticker-4",
    ticker: "GME",
    company_name: "GameStop Corp.",
    platform: "REDDIT",
    trending_score: 85,
    sentiment_score: 8.9,
    mention_count: 11200,
    engagement_score: 93,
    price_change_24h: 8.45,
    last_seen_at: new Date().toISOString(),
    first_seen_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "ticker-5",
    ticker: "AMD",
    company_name: "Advanced Micro Devices",
    platform: "TWITTER",
    trending_score: 82,
    sentiment_score: 7.5,
    mention_count: 7890,
    engagement_score: 84,
    price_change_24h: 2.34,
    last_seen_at: new Date().toISOString(),
    first_seen_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock Trending Topics Data
export const mockTrendingTopics: TrendingTopic[] = [
  {
    id: "topic-1",
    topic: "AI Revolution",
    topic_type: "Technology",
    platform: "TWITTER",
    trending_score: 96,
    engagement_score: 94,
    mention_count: 25400,
    related_tickers: ["NVDA", "AMD", "MSFT", "GOOGL"],
    first_seen_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "topic-2",
    topic: "Federal Reserve Rate Decision",
    topic_type: "Economy",
    platform: "TWITTER",
    trending_score: 91,
    engagement_score: 89,
    mention_count: 18750,
    related_tickers: ["SPY", "QQQ", "DIA"],
    first_seen_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "topic-3",
    topic: "EV Market Competition",
    topic_type: "Industry",
    platform: "YOUTUBE",
    trending_score: 87,
    engagement_score: 85,
    mention_count: 12340,
    related_tickers: ["TSLA", "RIVN", "LCID", "NIO"],
    first_seen_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "topic-4",
    topic: "Meme Stock Rally",
    topic_type: "Trading",
    platform: "REDDIT",
    trending_score: 84,
    engagement_score: 92,
    mention_count: 15680,
    related_tickers: ["GME", "AMC", "BBBY"],
    first_seen_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock Earnings Data
export const mockEarnings = [
  {
    symbol: "AAPL",
    company_name: "Apple Inc.",
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: "after-market",
    estimate: 1.54,
    actual: null,
  },
  {
    symbol: "MSFT",
    company_name: "Microsoft Corporation",
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: "after-market",
    estimate: 2.76,
    actual: null,
  },
  {
    symbol: "GOOGL",
    company_name: "Alphabet Inc.",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: "after-market",
    estimate: 1.89,
    actual: null,
  },
  {
    symbol: "TSLA",
    company_name: "Tesla, Inc.",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: "after-market",
    estimate: 0.85,
    actual: 0.91,
  },
];

// In-memory storage for user interactions
export const mockUserData = {
  likes: new Set<string>(),
  favorites: new Map<string, { notes?: string; created_at: string }>(),
  trackedKols: new Set<string>(),
  trackedStocks: new Set<string>(),
};

