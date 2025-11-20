/**
 * Platform Configuration
 * Centralized configuration for all social media platforms
 */

export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "XIAOHONGSHU" | "REDNOTE";
export type PlatformLowercase = "twitter" | "reddit" | "youtube" | "xiaohongshu" | "rednote" | "x";

export interface PlatformConfig {
  name: string;
  icon: string;
  color: string;
  colorClass: string;
}

/**
 * Platform configuration with uppercase keys (for database/API)
 */
export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  TWITTER: {
    name: "X (Twitter)",
    icon: "/logo/x.svg",
    color: "#1DA1F2",
    colorClass: "text-black dark:text-white",
  },
  REDDIT: {
    name: "Reddit",
    icon: "/logo/reddit.svg",
    color: "#FF4500",
    colorClass: "text-[#FF4500]",
  },
  YOUTUBE: {
    name: "YouTube",
    icon: "/logo/youtube.svg",
    color: "#FF0000",
    colorClass: "text-[#FF0000]",
  },
  XIAOHONGSHU: {
    name: "Xiaohongshu",
    icon: "/logo/rednote.svg",
    color: "#FF2442",
    colorClass: "text-[#FF2442]",
  },
  REDNOTE: {
    name: "Rednote",
    icon: "/logo/rednote.svg",
    color: "#FF2442",
    colorClass: "text-[#FF2442]",
  },
} as const;

/**
 * Platform configuration with lowercase keys (for frontend usage)
 */
export const PLATFORM_CONFIG_LOWERCASE: Record<
  PlatformLowercase,
  PlatformConfig
> = {
  twitter: PLATFORM_CONFIG.TWITTER,
  x: PLATFORM_CONFIG.TWITTER,
  reddit: PLATFORM_CONFIG.REDDIT,
  youtube: PLATFORM_CONFIG.YOUTUBE,
  xiaohongshu: PLATFORM_CONFIG.XIAOHONGSHU,
  rednote: PLATFORM_CONFIG.REDNOTE,
} as const;

/**
 * Get platform config by key (case-insensitive)
 */
export function getPlatformConfig(
  platform: string
): PlatformConfig | undefined {
  const upperKey = platform.toUpperCase() as Platform;
  const lowerKey = platform.toLowerCase() as PlatformLowercase;

  return (
    PLATFORM_CONFIG[upperKey] || PLATFORM_CONFIG_LOWERCASE[lowerKey]
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
    value: "x",
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
    value: "rednote",
    label: "Rednote",
    iconPath: "/logo/rednote.svg",
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

