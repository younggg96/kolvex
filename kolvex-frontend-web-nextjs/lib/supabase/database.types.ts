// Database types for Supabase

export type NotificationMethod = "EMAIL" | "MESSAGE";
export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "XIAOHONGSHU" | "REDNOTE";
export type Theme = "LIGHT" | "DARK" | "SYSTEM";
export type Membership = "FREE" | "PRO" | "ENTERPRISE";

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  phone_e164?: string;
  membership?: Membership;
  theme?: Theme;
  is_subscribe_newsletter?: boolean;
  notification_method?: NotificationMethod;
  created_at: string;
  updated_at: string;
}

export interface KOLSubscription {
  id: string;
  user_id: string;
  platform: Platform;
  kol_id: string;
  notify: boolean;
  created_at: string;
}

export interface StockTracking {
  id: string;
  user_id: string;
  symbol: string;
  created_at: string;
}

export interface NotificationSettings {
  notification_method?: NotificationMethod;
}

export interface ProfileUpdate {
  username?: string | null;
  avatar_url?: string;
  phone_e164?: string | null;
  is_subscribe_newsletter?: boolean;
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

