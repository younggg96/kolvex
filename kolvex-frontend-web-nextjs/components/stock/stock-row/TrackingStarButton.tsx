"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTrackedStock, deleteTrackedStock } from "@/lib/trackedStockApi";
import { toast } from "sonner";
import type { StockRowVariant } from "./types";

interface TrackingStarButtonProps {
  variant: StockRowVariant;
  ticker: string;
  companyName?: string;
  /** 股票的追踪记录 ID（用于取消追踪） */
  stockId?: string;
  /** 初始追踪状态 */
  isTracked?: boolean;
  /** 是否正在取消追踪（外部控制，用于 tracking 模式） */
  isUntracking?: boolean;
  /** 取消追踪回调（用于 tracking 模式的外部控制） */
  onUntrack?: (e: MouseEvent) => void;
  /** 追踪状态变化回调 */
  onTrackChange?: (tracked: boolean, stockId?: string) => void;
}

/**
 * 追踪/取消追踪 Star 按钮组件
 * - trending 模式: 根据 isTracked 状态显示空心/实心星星，点击切换追踪状态
 * - tracking 模式: 显示实心星星，点击取消追踪（外部控制）
 */
export function TrackingStarButton({
  variant,
  ticker,
  companyName,
  stockId: initialStockId,
  isTracked: initialTracked = false,
  isUntracking = false,
  onUntrack,
  onTrackChange,
}: TrackingStarButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTracked, setIsTracked] = useState(initialTracked);
  const [stockId, setStockId] = useState<string | undefined>(initialStockId);

  // 同步外部传入的 isTracked 状态
  useEffect(() => {
    setIsTracked(initialTracked);
  }, [initialTracked]);

  // 同步外部传入的 stockId
  useEffect(() => {
    setStockId(initialStockId);
  }, [initialStockId]);

  // Tracking 模式：使用外部控制的取消追踪
  if (variant === "tracking") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="text-yellow-400 hover:text-yellow-500"
        onClick={onUntrack}
        disabled={isUntracking}
      >
        {isUntracking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Star className="h-4 w-4 fill-current" />
        )}
      </Button>
    );
  }

  // Trending 模式：处理追踪/取消追踪
  const handleClick = async (e: MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);

    if (isTracked && stockId) {
      // 取消追踪
      try {
        await deleteTrackedStock(stockId);
        toast.success(`Removed ${ticker} from watchlist`);
        setIsTracked(false);
        setStockId(undefined);
        onTrackChange?.(false);
      } catch (err: any) {
        console.error("Error untracking stock:", err);
        toast.error(err.message || "Failed to remove stock from watchlist");
      }
    } else if (!isTracked) {
      // 添加追踪
      try {
        const result = await createTrackedStock({
          symbol: ticker,
          companyName,
        });
        toast.success(`Added ${ticker} to watchlist`);
        setIsTracked(true);
        setStockId(result.id);
        onTrackChange?.(true, result.id);
      } catch (err: any) {
        console.error("Error tracking stock:", err);
        toast.error(err.message || "Failed to add stock to watchlist");
      }
    }

    setIsLoading(false);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "h-7 w-7 hover:text-yellow-400 transition-colors",
        isTracked && "text-yellow-400"
      )}
      title={isTracked ? "Remove from watchlist" : "Add to watchlist"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star
          className={cn("h-4 w-4 transition-all", isTracked && "fill-current")}
        />
      )}
    </Button>
  );
}
