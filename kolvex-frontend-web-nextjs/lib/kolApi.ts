// KOL API types and utilities
// 支持多平台统一数据结构

export type Platform = "twitter" | "xiaohongshu" | "reddit" | "youtube";

export interface KOL {
  id: string;
  name: string;
  username: string;
  platform: Platform;
  platformUserId?: string; // 平台特定用户 ID
  followers: number;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  location?: string;
  website?: string;
  profileUrl?: string;
  isVerified?: boolean;
  verificationType?: string;
  isTracking: boolean;
  notify?: boolean;
  // 小红书特有字段
  redId?: string;
  gender?: string;
  likesCount?: number;
  collectedCount?: number;
  category?: string;
  tags?: string[];
}

export interface CreateKOLInput {
  name: string;
  username: string;
  platform: Platform;
  followers: number;
  description?: string;
  avatarUrl?: string;
  isTracking: boolean;
}

export interface PlatformConfig {
  name: string;
  icon: string;
  color: string;
  colorClass: string;
}

/**
 * Platform configuration for display
 */
export const platformConfig: Record<Platform, PlatformConfig> = {
  twitter: {
    name: "X (Twitter)",
    icon: "/logo/x.svg",
    color: "#1DA1F2",
    colorClass: "text-black dark:text-white",
  },
  xiaohongshu: {
    name: "小红书",
    icon: "/logo/xiaohongshu.svg",
    color: "#FE2C55",
    colorClass: "text-pink-500",
  },
  reddit: {
    name: "Reddit",
    icon: "/logo/reddit.svg",
    color: "#FF4500",
    colorClass: "text-orange-500",
  },
  youtube: {
    name: "YouTube",
    icon: "/logo/youtube.svg",
    color: "#FF0000",
    colorClass: "text-red-500",
  },
};

/**
 * Format followers count for display (1000 -> 1K, 1000000 -> 1M)
 */
export function formatFollowers(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return String(count);
}

/**
 * Update KOL (placeholder for API call)
 * This function is a placeholder and should be replaced with actual API call
 */
export async function updateKOL(id: string, data: Partial<KOL>): Promise<void> {
  // This is a placeholder - the actual tracking is done through trackKOL/untrackKOL
  console.log("updateKOL called with:", id, data);
}
