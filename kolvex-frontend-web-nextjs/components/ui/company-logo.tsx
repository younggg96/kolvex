import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Financial Modeling Prep 图片 URL 基础路径 */
const FMP_IMAGE_BASE_URL = "https://financialmodelingprep.com/image-stock";

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
  xs: { container: "w-6 h-6", image: 24, text: "text-[8px]" },
  sm: { container: "w-8 h-8", image: 32, text: "text-[10px]" },
  md: { container: "w-10 h-10", image: 40, text: "text-xs" },
  lg: { container: "w-12 h-12", image: 48, text: "text-sm" },
  xl: { container: "w-16 h-16", image: 64, text: "text-base" },
};

const shapeMap = {
  square: "rounded-none",
  rounded: "rounded-lg", // 稍微增加圆角，更现代
  circle: "rounded-full",
};

const borderMap = {
  none: "",
  light: "border",
  normal: "border-2",
  heavy: "border-4",
};

const borderColorMap = {
  gray: "border-gray-100 dark:border-gray-800", // 更淡的边框，更现代
  primary: "border-primary/20 dark:border-primary/40",
  orange: "border-orange-200 dark:border-orange-700",
  custom: "",
};

/**
 * CompanyLogo - 统一的公司 Logo 组件
 *
 * 用于显示公司 logo，支持多种尺寸、形状、边框样式
 * 图片自动从 Financial Modeling Prep 获取
 * 当图片加载失败时，自动显示股票代码缩写作为回退
 *
 * @example
 * ```tsx
 * <CompanyLogo
 *   symbol="AAPL"
 *   name="Apple Inc."
 *   size="md"
 *   shape="rounded"
 *   border="light"
 * />
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
  textColor = "text-gray-500 dark:text-gray-400", // 更柔和的文字颜色
  unoptimized = false,
  className = "",
  imageClassName = "",
}: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);

  // 根据股票代码生成图片 URL
  const logoUrl = `${FMP_IMAGE_BASE_URL}/${symbol.toUpperCase()}.png`;

  // 获取尺寸配置
  const sizeConfig = sizeMap[size];
  const containerSize = customSize
    ? `w-[${customSize}px] h-[${customSize}px]`
    : sizeConfig.container;
  const imageSize = customSize || sizeConfig.image;

  // 获取样式类
  const shapeClass = shapeMap[shape];
  const borderClass = borderMap[border];
  const borderColorClass = customBorderColor
    ? customBorderColor
    : borderColorMap[borderColor];

  const abbreviation = symbol.toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center justify-center flex-shrink-0 overflow-hidden relative transition-all bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark",
        "p-1", // 保持内边距，让 logo 有呼吸感
        containerSize,
        // 如果出错使用柔和的灰色背景，否则使用传入的背景（默认白色）
        hasError ? "bg-gray-50 dark:bg-gray-800" : bgColor,
        shapeClass,
        borderClass,
        borderColorClass,
        className
      )}
    >
      {!hasError ? (
        <Image
          src={logoUrl}
          alt={name || symbol}
          width={imageSize}
          height={imageSize}
          className={cn("object-contain w-full h-full", imageClassName)}
          unoptimized={unoptimized}
          onError={() => setHasError(true)}
          priority={false}
          loading="lazy"
          quality={85}
        />
      ) : (
        <span
          className={cn(
            "font-medium tracking-tight", // 字体加粗度适中，稍微紧凑
            customSize ? `text-[${customSize / 4}px]` : sizeConfig.text,
            textColor
          )}
        >
          {abbreviation}
        </span>
      )}
    </div>
  );
}

