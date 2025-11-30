/**
 * 用户 API 客户端
 * 与后端 FastAPI 服务交互
 */
import { createClient } from "@/lib/supabase/client";

// API 基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 用户资料接口
export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  phone_e164?: string;
  membership: "FREE" | "PRO" | "ENTERPRISE";
  theme?: "LIGHT" | "DARK" | "SYSTEM";
  is_subscribe_newsletter: boolean;
  notification_method?: "EMAIL" | "MESSAGE";
  created_at: string;
  updated_at: string;
}

// 用户资料更新接口
export interface UserProfileUpdate {
  username?: string;
  full_name?: string;
  avatar_url?: string;
  phone_e164?: string;
  theme?: "LIGHT" | "DARK" | "SYSTEM";
  is_subscribe_newsletter?: boolean;
  notification_method?: "EMAIL" | "MESSAGE";
}

// 主题更新接口
export interface UserThemeUpdate {
  theme: "LIGHT" | "DARK" | "SYSTEM";
}

// 通知设置更新接口
export interface UserNotificationUpdate {
  is_subscribe_newsletter?: boolean;
  notification_method?: "EMAIL" | "MESSAGE";
}

// API 响应接口
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 获取认证 token
 *
 * 从 Cookie 中读取 Supabase session 并提取 access token
 * Session 会在用户登录时自动存储到 Cookie 中
 */
async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("未登录或 token 已过期");
  }

  return session.access_token;
}

/**
 * 发送带认证的 API 请求
 *
 * 自动从 Cookie 中获取 access token 并添加到请求头
 * 后端会验证 Bearer token
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  } catch (error: any) {
    console.error(`API 请求失败 [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * 获取当前用户资料
 */
export async function getCurrentUserProfile(): Promise<
  ApiResponse<UserProfile>
> {
  try {
    const data = await fetchWithAuth<UserProfile>("/api/v1/users/me");
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 更新当前用户资料
 */
export async function updateCurrentUserProfile(
  updates: UserProfileUpdate
): Promise<ApiResponse<UserProfile>> {
  try {
    const data = await fetchWithAuth<UserProfile>("/api/v1/users/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 更新用户主题
 */
export async function updateUserTheme(
  theme: "LIGHT" | "DARK" | "SYSTEM"
): Promise<ApiResponse<UserProfile>> {
  try {
    const data = await fetchWithAuth<UserProfile>("/api/v1/users/me/theme", {
      method: "PATCH",
      body: JSON.stringify({ theme }),
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 更新用户通知设置
 */
export async function updateUserNotifications(
  updates: UserNotificationUpdate
): Promise<ApiResponse<UserProfile>> {
  try {
    const data = await fetchWithAuth<UserProfile>(
      "/api/v1/users/me/notifications",
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      }
    );
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 删除当前用户资料
 */
export async function deleteCurrentUserProfile(): Promise<
  ApiResponse<{ message: string }>
> {
  try {
    const data = await fetchWithAuth<{ message: string }>("/api/v1/users/me", {
      method: "DELETE",
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 获取指定用户的公开资料
 */
export async function getUserProfileById(
  userId: string
): Promise<ApiResponse<UserProfile>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 创建用户资料
 */
export async function createUserProfile(profileData: {
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
}): Promise<ApiResponse<UserProfile>> {
  try {
    const data = await fetchWithAuth<UserProfile>("/api/v1/users/", {
      method: "POST",
      body: JSON.stringify(profileData),
    });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// React Hook（可选）
import { useState, useEffect } from "react";

/**
 * 使用当前用户资料的 Hook
 */
export function useCurrentUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    const result = await getCurrentUserProfile();

    if (result.success && result.data) {
      setProfile(result.data);
    } else {
      setError(result.error || "加载用户资料失败");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateProfile = async (updates: UserProfileUpdate) => {
    const result = await updateCurrentUserProfile(updates);

    if (result.success && result.data) {
      setProfile(result.data);
      return { success: true };
    }

    return { success: false, error: result.error };
  };

  const updateTheme = async (theme: "LIGHT" | "DARK" | "SYSTEM") => {
    const result = await updateUserTheme(theme);

    if (result.success && result.data) {
      setProfile(result.data);
      return { success: true };
    }

    return { success: false, error: result.error };
  };

  const updateNotifications = async (updates: UserNotificationUpdate) => {
    const result = await updateUserNotifications(updates);

    if (result.success && result.data) {
      setProfile(result.data);
      return { success: true };
    }

    return { success: false, error: result.error };
  };

  return {
    profile,
    loading,
    error,
    refetch: loadProfile,
    updateProfile,
    updateTheme,
    updateNotifications,
  };
}
