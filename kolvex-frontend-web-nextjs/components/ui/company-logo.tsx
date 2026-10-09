"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Financial Modeling Prep 图片 URL 基础路径 */
const FMP_IMAGE_BASE_URL = "https://financialmodelingprep.com/image-stock";

/** Some providers return a successful response containing only a blank image. */
function isBlankLogo(image: HTMLImageElement): boolean {
  if (!image.naturalWidth || !image.naturalHeight) return true;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      // Composite against the white logo background, including transparent pixels.
      const alpha = data[i + 3] / 255;
      if ([data[i], data[i + 1], data[i + 2]].some(
        (channel) => channel * alpha + 255 * (1 - alpha) < 245
      )) return false;
    }
    return true;
  } catch {
    // Unoptimized cross-origin images may not permit reading their pixels.
    return false;
  }
}

/** FMP file name for a symbol, or null when the symbol cannot have a company logo (indexes, futures, FX). */
function fmpLogoKey(symbol: string): string | null {
  if (!symbol || /[\^=/\s]/.test(symbol)) return null;
  const crypto = symbol.match(/^([A-Z0-9]+)-USD$/);
  if (crypto) return `${crypto[1]}USD`;
  return symbol.replace(/\./g, "-");
}

interface CompanyLogoProps {
  /** Stock symbol (用于生成图片 URL 和 fallback 显示) */
  symbol: string;
  /** Company name for alt text */
  name?: string;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Custom size in pixels (overrides size variant) */
  customSize?: number;
  /** Shape variant */
  shape?: "square" | "rounded" | "circle";
  /** Border style */
  border?: "none" | "light" | "normal" | "heavy";
  /** Border color variant */
  borderColor?: "gray" | "primary" | "orange" | "custom";
  /** Custom border color class */
  customBorderColor?: string;
  /** Background color */
  bgColor?: string;
  /** Text color for fallback */
  textColor?: string;
  /** Whether to use unoptimized image loading (默认false以启用缓存优化) */
  unoptimized?: boolean;
  /** Additional container classes */
  className?: string;
  /** Additional image classes */
  imageClassName?: string;
}

const sizeMap = {
  xs: { px: 20, padding: 2, chars: 1 },
  sm: { px: 32, padding: 4, chars: 3 },
  md: { px: 40, padding: 5, chars: 4 },
  lg: { px: 48, padding: 6, chars: 4 },
  xl: { px: 64, padding: 8, chars: 4 },
};

const shapeMap = {
  square: "rounded-none",
  rounded: "rounded-[22%]",
  circle: "rounded-full",
};

const borderMap = {
  none: "border-0",
  light: "border",
  normal: "border-2",
  heavy: "border-4",
};

const borderColorMap = {
  gray: "border-border",
  primary: "border-primary/20 dark:border-primary/40",
  orange: "border-warning/30",
  custom: "",
};

/**
 * CompanyLogo - 统一的公司 Logo 组件
 *
 * 用于显示公司 logo，支持多种尺寸、形状、边框样式
 * 图片自动从 Financial Modeling Prep 获取
 * 当图片加载失败时，显示按尺寸截短的股票代码作为回退
 *
 * @example
 * ```tsx
 * <CompanyLogo symbol="AAPL" name="Apple Inc." size="md" />
 * ```
 */
export default function CompanyLogo({
  symbol,
  name,
  size = "md",
  customSize,
  shape = "rounded",
  border = "light",
  borderColor = "gray",
  customBorderColor,
  bgColor = "bg-white",
  textColor = "text-muted-foreground",
  unoptimized = false,
  className = "",
  imageClassName = "",
}: CompanyLogoProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  const abbreviation = symbol.trim().toUpperCase();
  const logoKey = fmpLogoKey(abbreviation);
  const logoUrl = logoKey ? `${FMP_IMAGE_BASE_URL}/${logoKey}.png` : "";
  const hasError = !logoUrl || failedLogoUrl === logoUrl;

  const preset = sizeMap[size];
  const px = customSize || preset.px;
  const chars = customSize ? (px < 28 ? 1 : px < 36 ? 3 : 4) : preset.chars;
  const cleanSymbol = abbreviation.replace(/[^A-Z0-9]/g, "");
  const fallbackText =
    (cleanSymbol.length <= chars ? cleanSymbol : cleanSymbol.slice(0, 1)) || "?";

  return (
    <div
      title={name || abbreviation}
      style={{
        width: px,
        height: px,
        padding: hasError ? 0 : customSize ? Math.round(px / 8) : preset.padding,
      }}
      className={cn(
        "relative flex flex-shrink-0 items-center justify-center overflow-hidden",
        hasError ? "bg-muted" : bgColor,
        shapeMap[shape],
        borderMap[border],
        customBorderColor || borderColorMap[borderColor],
        className
      )}
    >
      {!hasError ? (
        <Image
          key={logoUrl}
          src={logoUrl}
          alt={name || abbreviation}
          width={px}
          height={px}
          className={cn("h-full w-full object-contain", imageClassName)}
          unoptimized={unoptimized}
          onError={() => setFailedLogoUrl(logoUrl)}
          onLoad={(event) => {
            if (isBlankLogo(event.currentTarget)) setFailedLogoUrl(logoUrl);
          }}
          loading="lazy"
          quality={85}
        />
      ) : (
        <span
          style={{ fontSize: Math.max(9, Math.round(px / (fallbackText.length > 2 ? 3.6 : 2.6))) }}
          className={cn("font-semibold leading-none tracking-tight", textColor)}
        >
          {fallbackText}
        </span>
      )}
    </div>
  );
}
