/**
 * 股票预警 API
 * Stock Alert API Client
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ==================== Types ====================

export type NotificationChannelType =
  | "email"
  | "discord"
  | "telegram"
  | "wechat"
  | "whatsapp";

export interface AlertRule {
  id: string;
  user_id: string;
  symbol: string;
  company_name?: string;

  daily_change_threshold: number;
  spike_change_threshold: number;
  price_above?: number;
  price_below?: number;
  volume_surge_multiplier: number;

  premarket_enabled: boolean;
  regular_hours_enabled: boolean;
  afterhours_enabled: boolean;

  channels: NotificationChannelType[];
  ai_analysis_enabled: boolean;
  cooldown_minutes: number;

  is_active: boolean;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertRuleCreate {
  symbol: string;
  company_name?: string;

  daily_change_threshold?: number;
  spike_change_threshold?: number;
  price_above?: number;
  price_below?: number;
  volume_surge_multiplier?: number;

  premarket_enabled?: boolean;
  regular_hours_enabled?: boolean;
  afterhours_enabled?: boolean;

  channels?: NotificationChannelType[];
  ai_analysis_enabled?: boolean;
  cooldown_minutes?: number;
}

export interface AlertRuleUpdate {
  daily_change_threshold?: number;
  spike_change_threshold?: number;
  price_above?: number;
  price_below?: number;
  volume_surge_multiplier?: number;

  premarket_enabled?: boolean;
  regular_hours_enabled?: boolean;
  afterhours_enabled?: boolean;

  channels?: NotificationChannelType[];
  ai_analysis_enabled?: boolean;
  cooldown_minutes?: number;

  is_active?: boolean;
}

export interface NotificationChannel {
  id: string;
  user_id: string;
  channel_type: NotificationChannelType;

  discord_webhook_url?: string;
  telegram_chat_id?: string;
  wechat_webhook_url?: string;
  whatsapp_phone_number?: string;

  is_verified: boolean;
  verified_at?: string;
  created_at: string;
}

export interface ChannelConfigCreate {
  channel_type: NotificationChannelType;
  discord_webhook_url?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  wechat_webhook_url?: string;
  whatsapp_phone_number?: string;
}

export interface AlertHistory {
  id: string;
  user_id: string;
  rule_id?: string;
  symbol: string;
  alert_type: string;

  triggered_price: number;
  previous_price?: number;
  change_percent: number;
  volume?: number;
  market_session?: string;

  ai_summary?: string;
  risk_level?: string;
  ai_suggestion?: string;

  channels_sent: string[];
  channels_failed: any[];

  triggered_at: string;
  created_at: string;
}

export interface AlertStats {
  period_days: number;
  total_alerts: number;
  active_rules: number;
  by_symbol: Record<string, number>;
  by_type: Record<string, number>;
  by_risk_level: Record<string, number>;
  top_symbols: { symbol: string; count: number }[];
  avg_alerts_per_day: number;
}

// ==================== Helper ====================

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get token from cookie or localStorage
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

// ==================== Alert Rules API ====================

export async function getAlertRules(
  isActive?: boolean
): Promise<{ rules: AlertRule[]; total: number }> {
  const params = new URLSearchParams();
  if (isActive !== undefined) {
    params.append("is_active", String(isActive));
  }

  const response = await fetchWithAuth(
    `/stock-alerts/rules?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch alert rules");
  }

  return response.json();
}

export async function getAlertRule(ruleId: string): Promise<AlertRule> {
  const response = await fetchWithAuth(`/stock-alerts/rules/${ruleId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch alert rule");
  }

  return response.json();
}

export async function createAlertRule(
  data: AlertRuleCreate
): Promise<AlertRule> {
  const response = await fetchWithAuth("/stock-alerts/rules", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create alert rule");
  }

  return response.json();
}

export async function updateAlertRule(
  ruleId: string,
  data: AlertRuleUpdate
): Promise<AlertRule> {
  const response = await fetchWithAuth(`/stock-alerts/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update alert rule");
  }

  return response.json();
}

export async function deleteAlertRule(
  ruleId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`/stock-alerts/rules/${ruleId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete alert rule");
  }

  return response.json();
}

export async function toggleAlertRule(ruleId: string): Promise<AlertRule> {
  const response = await fetchWithAuth(`/stock-alerts/rules/${ruleId}/toggle`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to toggle alert rule");
  }

  return response.json();
}

// ==================== Notification Channels API ====================

export async function getNotificationChannels(): Promise<{
  channels: NotificationChannel[];
  total: number;
}> {
  const response = await fetchWithAuth("/stock-alerts/channels");

  if (!response.ok) {
    throw new Error("Failed to fetch notification channels");
  }

  return response.json();
}

export async function createNotificationChannel(
  data: ChannelConfigCreate
): Promise<NotificationChannel> {
  const response = await fetchWithAuth("/stock-alerts/channels", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create notification channel");
  }

  return response.json();
}

export async function updateNotificationChannel(
  channelId: string,
  data: Partial<ChannelConfigCreate>
): Promise<NotificationChannel> {
  const response = await fetchWithAuth(`/stock-alerts/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update notification channel");
  }

  return response.json();
}

export async function deleteNotificationChannel(
  channelId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`/stock-alerts/channels/${channelId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete notification channel");
  }

  return response.json();
}

export async function testNotificationChannel(channelId: string): Promise<{
  success: boolean;
  channels_sent: string[];
  channels_failed: any[];
  message: string;
}> {
  const response = await fetchWithAuth(
    `/stock-alerts/channels/${channelId}/test`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to test notification channel");
  }

  return response.json();
}

export async function testAlert(data: {
  symbol: string;
  channels: NotificationChannelType[];
  test_message?: string;
}): Promise<{
  success: boolean;
  channels_sent: string[];
  channels_failed: any[];
  message: string;
}> {
  const response = await fetchWithAuth("/stock-alerts/test", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to send test alert");
  }

  return response.json();
}

// ==================== Alert History API ====================

export async function getAlertHistory(params?: {
  symbol?: string;
  alert_type?: string;
  risk_level?: string;
  days?: number;
  limit?: number;
  offset?: number;
}): Promise<{ history: AlertHistory[]; total: number }> {
  const searchParams = new URLSearchParams();

  if (params?.symbol) searchParams.append("symbol", params.symbol);
  if (params?.alert_type) searchParams.append("alert_type", params.alert_type);
  if (params?.risk_level) searchParams.append("risk_level", params.risk_level);
  if (params?.days) searchParams.append("days", String(params.days));
  if (params?.limit) searchParams.append("limit", String(params.limit));
  if (params?.offset) searchParams.append("offset", String(params.offset));

  const response = await fetchWithAuth(
    `/stock-alerts/history?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch alert history");
  }

  return response.json();
}

export async function getAlertStats(days?: number): Promise<AlertStats> {
  const params = days ? `?days=${days}` : "";
  const response = await fetchWithAuth(`/stock-alerts/stats${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch alert stats");
  }

  return response.json();
}

export async function clearAlertHistory(
  daysOld: number
): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(
    `/stock-alerts/history?days_old=${daysOld}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to clear alert history");
  }

  return response.json();
}
