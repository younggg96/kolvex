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
}

export interface SnapTradePublicHoldings {
  user_id: string;
  last_synced_at?: string;
  accounts: SnapTradeAccount[];
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
  total_value: number;
  total_pnl: number;
  pnl_percent: number;
  positions_count: number;
  top_positions: TopPosition[];
}

export interface PublicUsersResponse {
  users: PublicUserSummary[];
  total: number;
}
