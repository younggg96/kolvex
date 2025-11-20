// API functions for managing tracked KOLs
import type { Platform } from "@/lib/mockData";

export interface TrackedKOL {
  user_id: string;
  kol_id: string;
  platform: Platform;
  notify: boolean;
  updated_at: string;
  creator_name?: string;
  creator_avatar_url?: string;
  creator_username?: string;
  creator_verified?: boolean;
  creator_bio?: string | null;
  creator_followers_count?: number;
  creator_category?: string | null;
  creator_influence_score?: number;
  creator_trending_score?: number;
  posts_count?: number;
  latest_post_date?: string;
}

export interface CreateTrackedKOLInput {
  kol_id: string;
  platform: Platform;
  notify?: boolean;
}

export interface UpdateTrackedKOLInput {
  notify?: boolean;
}

export interface TrackedKOLsResponse {
  count: number;
  tracked_kols: TrackedKOL[];
}

// GET - 获取追踪的 KOL 列表
export async function fetchTrackedKOLs(
  platform?: Platform,
  notify?: boolean
): Promise<TrackedKOLsResponse> {
  const params = new URLSearchParams();
  if (platform) params.append("platform", platform);
  if (notify !== undefined) params.append("notify", notify.toString());

  const url = `/api/my-tracked-kols${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to fetch tracked KOLs");
  }

  return response.json();
}

// POST - 添加追踪的 KOL
export async function trackKOL(
  data: CreateTrackedKOLInput
): Promise<TrackedKOL> {
  const response = await fetch("/api/my-tracked-kols", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to track KOL");
  }

  return response.json();
}

// PATCH - 更新追踪的 KOL
export async function updateTrackedKOL(
  kol_id: string,
  platform: Platform,
  data: UpdateTrackedKOLInput
): Promise<TrackedKOL> {
  const response = await fetch("/api/my-tracked-kols", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kol_id,
      platform,
      ...data,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to update tracked KOL");
  }

  return response.json();
}

// DELETE - 取消追踪 KOL
export async function untrackKOL(
  kol_id: string,
  platform: Platform
): Promise<void> {
  const response = await fetch("/api/my-tracked-kols", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kol_id,
      platform,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to untrack KOL");
  }
}

// 批量操作 - 追踪多个 KOL
export async function trackMultipleKOLs(
  kols: CreateTrackedKOLInput[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = await Promise.allSettled(kols.map((kol) => trackKOL(kol)));

  const success = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason.message);

  return { success, failed, errors };
}

// 批量操作 - 取消追踪多个 KOL
export async function untrackMultipleKOLs(
  kols: { kol_id: string; platform: Platform }[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = await Promise.allSettled(
    kols.map((kol) => untrackKOL(kol.kol_id, kol.platform))
  );

  const success = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason.message);

  return { success, failed, errors };
}

// 检查是否正在追踪某个 KOL
export async function isTrackingKOL(
  kol_id: string,
  platform: Platform
): Promise<boolean> {
  try {
    const response = await fetchTrackedKOLs(platform);
    return response.tracked_kols.some((kol) => kol.kol_id === kol_id);
  } catch (error) {
    console.error("Error checking if tracking KOL:", error);
    return false;
  }
}

// 切换追踪状态
export async function toggleTrackKOL(
  kol_id: string,
  platform: Platform
): Promise<{ isTracking: boolean }> {
  const isTracking = await isTrackingKOL(kol_id, platform);

  if (isTracking) {
    await untrackKOL(kol_id, platform);
    return { isTracking: false };
  } else {
    await trackKOL({ kol_id, platform, notify: true });
    return { isTracking: true };
  }
}
