// Database types for Supabase

export type NotificationMethod = "EMAIL" | "MESSAGE";
export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";
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

// SnapTrade 相关类型
export interface SnapTradeConnection {
  id: string;
  user_id: string;
  snaptrade_user_id: string;
  is_connected: boolean;
  is_public: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SnapTradeAccount {
  id: string;
  connection_id: string;
  account_id: string;
  brokerage_name?: string;
  account_name?: string;
  account_number?: string;
  account_type?: string;
  created_at: string;
  updated_at: string;
  snaptrade_positions?: SnapTradePosition[];
}

export interface SnapTradePosition {
  id: string;
  account_id: string;
  position_type?: "equity" | "option";
  symbol: string;
  symbol_id?: string;
  security_name?: string;
  units: number;
  price?: number;
  open_pnl?: number;
  fractional_units?: number;
  average_purchase_price?: number;
  currency?: string;
  // Option-specific fields
  option_type?: "call" | "put";
  strike_price?: number;
  expiration_date?: string;
  underlying_symbol?: string;
  // Calculated fields from API
  weight_percent?: number; // Portfolio weight percentage (0-100)
  market_value?: number; // Current market value
  // Visibility control
  is_hidden?: boolean; // Whether position is hidden from public view
  created_at: string;
  updated_at: string;
}

export interface SnapTradeConnectionStatus {
  is_registered: boolean;
  is_connected: boolean;
  is_public: boolean;
  last_synced_at?: string;
  accounts_count: number;
}

export interface SnapTradeHoldings {
  is_connected: boolean;
  is_public: boolean;
  last_synced_at?: string;
  accounts: SnapTradeAccount[];
  total_value?: number | string; // Total portfolio value ("***" if hidden in public view)
  privacy_settings?: PrivacySettings; // Privacy settings for public view
  hidden_positions_count?: number; // Number of hidden positions (public view only)
  hidden_accounts_count?: number; // Number of hidden accounts (public view only)
}

export interface SnapTradePublicHoldings {
  user_id: string;
  is_connected: boolean; // Always true for public holdings
  is_public: boolean; // Always true for public holdings
  last_synced_at?: string;
  accounts: SnapTradeAccount[];
  total_value?: number | string; // Total portfolio value ("***" if hidden)
  total_pnl?: number | string; // Total P&L ("***" if hidden)
  pnl_percent?: number | string; // P&L percentage ("***" if hidden)
  positions_count?: number | string; // Number of visible positions ("***" if hidden)
  accounts_count?: number; // Number of visible accounts
  hidden_positions_count?: number; // Number of hidden positions
  hidden_accounts_count?: number; // Number of hidden accounts
  privacy_settings?: PrivacySettings; // Privacy settings applied
}

export interface PrivacySettings {
  show_total_value: boolean;
  show_total_pnl: boolean;
  show_pnl_percent: boolean;
  show_positions_count: boolean;
  show_shares: boolean;
  show_position_value: boolean;
  show_position_pnl: boolean;
  show_position_weight: boolean;
  show_position_cost: boolean;
  hidden_accounts: string[]; // Account IDs to hide
}

export interface TopPosition {
  symbol: string;
  value: number;
  pnl: number;
}

export interface PublicUserSummary {
  user_id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  last_synced_at?: string;
  total_value: number | null; // null if hidden by privacy settings
  total_pnl: number | null; // null if hidden by privacy settings
  pnl_percent: number | null; // null if hidden by privacy settings
  positions_count: number | null; // null if hidden by privacy settings
  top_positions: TopPosition[];
}

export interface PublicUsersResponse {
  users: PublicUserSummary[];
  total: number;
}

// Follow 相关类型
export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FollowStatus {
  is_following: boolean;
  followers_count: number;
  following_count: number;
}

export interface FollowUserInfo {
  user_id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  is_following: boolean;
}

export interface FollowListResponse {
  users: FollowUserInfo[];
  total: number;
  page: number;
  page_size: number;
}

// Notification 相关类型
export type NotificationType =
  | "POSITION_BUY"
  | "POSITION_SELL"
  | "POSITION_INCREASE"
  | "POSITION_DECREASE"
  | "NEW_FOLLOWER"
  | "SYSTEM";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_user_id?: string;
  related_symbol?: string;
  related_data?: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  page_size: number;
  unread_count: number;
}
