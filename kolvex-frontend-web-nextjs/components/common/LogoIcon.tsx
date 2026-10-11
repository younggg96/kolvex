/**
 * LogoIcon Component
 * 内联的Logo SVG组件，避免重复请求logo.svg文件
 */

import { KOLVEX_LOGO_COLOR, KOLVEX_LOGO_PATH } from "@/lib/brandAssets";

interface LogoIconProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function LogoIcon({
  className = "",
  size = 24,
  color = KOLVEX_LOGO_COLOR,
}: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={size}
      viewBox="0 -960 960 960"
      width={size}
      fill={color}
      className={className}
    >
      <path d={KOLVEX_LOGO_PATH} />
    </svg>
  );
}
