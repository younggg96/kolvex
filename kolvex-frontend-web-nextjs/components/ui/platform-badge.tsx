import Image from "next/image";
import { cn } from "@/lib/utils";
import { getPlatformConfig, type Platform } from "@/lib/platformConfig";

type BadgeSize = "xs" | "sm" | "md" | "lg";

interface PlatformBadgeProps {
  platform: string;
  size?: BadgeSize;
  showBackground?: boolean;
  className?: string;
}

const sizeConfig: Record<
  BadgeSize,
  { icon: number; padding: string; rounded: string }
> = {
  xs: { icon: 10, padding: "p-0.5", rounded: "rounded" },
  sm: { icon: 12, padding: "p-1", rounded: "rounded-md" },
  md: { icon: 14, padding: "p-1.5", rounded: "rounded-md" },
  lg: { icon: 16, padding: "p-2", rounded: "rounded-lg" },
};

export function PlatformBadge({
  platform,
  size = "sm",
  showBackground = true,
  className,
}: PlatformBadgeProps) {
  const config = getPlatformConfig(platform);

  if (!config) return null;

  const { icon: iconSize, padding, rounded } = sizeConfig[size];

  return (
    <div
      className={cn(
        showBackground && `${padding} ${rounded} bg-gray-100 dark:bg-gray/80`,
        className
      )}
    >
      <Image
        src={config.icon}
        alt={config.name}
        width={iconSize}
        height={iconSize}
      />
    </div>
  );
}
