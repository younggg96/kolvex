/**
 * KolvexWordmark
 * 「kolvex.」字标：浅色主题用深绿字，深色主题用米白字，绿色圆点不变。
 */

import { KOLVEX_WORDMARK } from "@/lib/brandAssets";
import { cn } from "@/lib/utils";

interface KolvexWordmarkProps {
  className?: string;
  /** Rendered height in px; width follows the artwork's aspect ratio. */
  height?: number;
}

export default function KolvexWordmark({ className, height = 22 }: KolvexWordmarkProps) {
  const width = Math.round((height * KOLVEX_WORDMARK.width) / KOLVEX_WORDMARK.height);
  return (
    <span className={cn("inline-flex shrink-0", className)} style={{ width, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={KOLVEX_WORDMARK.onLight}
        alt="Kolvex"
        width={width}
        height={height}
        className="block dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={KOLVEX_WORDMARK.onDark}
        alt="Kolvex"
        width={width}
        height={height}
        className="hidden dark:block"
      />
    </span>
  );
}
