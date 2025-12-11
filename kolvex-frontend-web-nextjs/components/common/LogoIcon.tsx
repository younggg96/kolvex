/**
 * LogoIcon Component
 * 内联的Logo SVG组件，避免重复请求logo.svg文件
 */

interface LogoIconProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function LogoIcon({
  className = "",
  size = 24,
  color = "#53d22d",
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
      <path d="M280-160v-90h-80v-460h80v-90h60v90h80v460h-80v90h-60Zm-20-150h100v-340H260v340Zm360 150v-210h-80v-260h80v-170h60v170h80v260h-80v210h-60Zm-20-270h100v-140H600v140Zm-290-50Zm340-20Z" />
    </svg>
  );
}
