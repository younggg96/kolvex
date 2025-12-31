/**
 * Platform Configuration
 * Centralized configuration for all social media platforms
 */

export type Platform = "twitter" | "reddit" | "youtube" | "xiaohongshu";
export type PlatformLowercase =
  | "twitter"
  | "x"
  | "reddit"
  | "youtube"
  | "xiaohongshu";

export interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  colorClass: string;
  url: string;
}

/**
 * Platform configuration with uppercase keys (for database/API)
 */
export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  twitter: {
    id: "twitter",
    name: "X",
    icon: "/logo/x.svg",
    color: "#1DA1F2",
    colorClass: "text-black dark:text-white",
    url: "https://twitter.com",
  },
  reddit: {
    id: "reddit",
    name: "Reddit",
    icon: "/logo/reddit.svg",
    color: "#FF4500",
    colorClass: "text-orange-500",
    url: "https://reddit.com",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    icon: "/logo/youtube.svg",
    color: "#FF0000",
    colorClass: "text-red-500",
    url: "https://youtube.com",
  },
  xiaohongshu: {
    id: "xiaohongshu",
    name: "Xiaohongshu",
    icon: "/logo/xiaohongshu.svg",
    color: "#FE2C55",
    colorClass: "text-pink-500",
    url: "https://xiaohongshu.com",
  },
} as const;

/**
 * Platform configuration with lowercase keys (for frontend usage)
 */
export const PLATFORM_CONFIG_LOWERCASE: Record<
  PlatformLowercase,
  PlatformConfig
> = {
  twitter: PLATFORM_CONFIG.twitter,
  x: PLATFORM_CONFIG.twitter,
  reddit: PLATFORM_CONFIG.reddit,
  youtube: PLATFORM_CONFIG.youtube,
  xiaohongshu: PLATFORM_CONFIG.xiaohongshu,
} as const;

/**
 * Get platform config by key (case-insensitive)
 */
export function getPlatformConfig(
  platform: string
): PlatformConfig | undefined {
  const lowerKey = platform.toLowerCase() as PlatformLowercase;
  return (
    PLATFORM_CONFIG[lowerKey as Platform] || PLATFORM_CONFIG_LOWERCASE[lowerKey]
  );
}

/**
 * Platform options for tabs/filters
 */
export const PLATFORM_TAB_OPTIONS = [
  {
    value: "all",
    label: "All",
    icon: "",
  },
  {
    value: "twitter",
    label: "X",
    iconPath: "/logo/x.svg",
  },
  {
    value: "reddit",
    label: "Reddit",
    iconPath: "/logo/reddit.svg",
  },
  {
    value: "youtube",
    label: "YouTube",
    iconPath: "/logo/youtube.svg",
  },
  {
    value: "xiaohongshu",
    label: "Xiaohongshu",
    iconPath: "/logo/xiaohongshu.svg",
  },
] as const;

/**
 * Post type options for filters
 */
export const POST_TAB_OPTIONS = [
  {
    value: "all",
    label: "All",
    icon: "",
  },
  {
    value: "tracking",
    label: "Tracking",
    icon: "",
  },
] as const;
