/**
 * Loading Skeleton Components
 * 用于显示各种加载状态的骨架屏组件
 */

// 市场指数卡片骨架屏
export function MarketIndexSkeleton() {
  return (
    <div className="bg-white dark:bg-card-dark p-4 rounded-lg border border-border-light dark:border-border-dark animate-pulse transition-colors duration-300">
      <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-20 mb-2"></div>
      <div className="h-6 bg-gray-300 dark:bg-white/10 rounded w-24 mb-2"></div>
      <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-16"></div>
    </div>
  );
}

// 监视列表项骨架屏
export function WatchlistItemSkeleton() {
  return (
    <div className="flex justify-between items-center py-0.5 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-gray-300 dark:bg-white/10 rounded-full"></div>
        <div>
          <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-12 mb-1"></div>
          <div className="h-2 bg-gray-300 dark:bg-white/10 rounded w-20"></div>
        </div>
      </div>
      <div className="text-right">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-14 mb-1"></div>
        <div className="h-2 bg-gray-300 dark:bg-white/10 rounded w-16"></div>
      </div>
    </div>
  );
}

// 图表加载骨架屏
export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-card-dark p-4 rounded-lg border border-border-light dark:border-border-dark transition-colors duration-300">
      <div className="flex justify-between items-center mb-4 animate-pulse">
        <div>
          <div className="h-5 bg-gray-300 dark:bg-white/10 rounded w-16 mb-1"></div>
          <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-24"></div>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-6 w-10 bg-gray-300 dark:bg-white/10 rounded-full"
            ></div>
          ))}
        </div>
      </div>
      <div className="h-56 bg-gray-200 dark:bg-white/5 rounded animate-pulse"></div>
    </div>
  );
}

// 新闻卡片骨架屏
export function NewsItemSkeleton() {
  return (
    <div className="flex items-start gap-2.5 animate-pulse">
      <div className="w-14 h-10 bg-gray-300 dark:bg-white/10 rounded-lg flex-shrink-0"></div>
      <div className="flex-1 min-w-0">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-full mb-1"></div>
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-3/4 mb-2"></div>
        <div className="h-2 bg-gray-300 dark:bg-white/10 rounded w-20"></div>
      </div>
    </div>
  );
}

// 通用卡片骨架屏
interface CardSkeletonProps {
  lines?: number;
  className?: string;
}

export function CardSkeleton({ lines = 3, className = "" }: CardSkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-card-dark p-4 rounded-lg border border-border-light dark:border-border-dark animate-pulse transition-colors duration-300 ${className}`}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-300 dark:bg-white/10 rounded mb-2 last:mb-0"
          style={{ width: `${100 - i * 15}%` }}
        ></div>
      ))}
    </div>
  );
}

// 组合加载骨架屏 - 用于显示多个相同的骨架屏
interface SkeletonGridProps {
  count: number;
  children: React.ReactNode;
}

export function SkeletonGrid({ count, children }: SkeletonGridProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{children}</div>
      ))}
    </>
  );
}

// 个人信息骨架屏
export function ProfileInfoSkeleton() {
  return (
    <div className="space-y-4 px-4 pb-4 animate-pulse">
      {/* Avatar Skeleton */}
      <div className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-300 dark:bg-white/10"></div>
      </div>

      {/* Email Skeleton */}
      <div className="space-y-1.5">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-24 mb-2"></div>
        <div className="h-9 bg-gray-200 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"></div>
      </div>

      {/* Full Name Skeleton */}
      <div className="space-y-1.5">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-24 mb-2"></div>
        <div className="h-9 bg-gray-200 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"></div>
      </div>

      {/* Phone Skeleton */}
      <div className="space-y-1.5">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-28 mb-2"></div>
        <div className="h-9 bg-gray-200 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"></div>
      </div>
    </div>
  );
}

// 通知项骨架屏 - 匹配新的卡片式设计
export function NotificationItemSkeleton() {
  return (
    <div className="rounded-xl bg-white dark:bg-card-dark/50 border border-gray-100 dark:border-white/5 animate-pulse">
      <div className="flex items-start gap-4 p-4 pl-5">
        {/* Logo/Icon Skeleton - 带叠加小图标 */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-white/10"></div>
          {/* 操作类型小图标 */}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-300 dark:bg-white/15 border-2 border-white dark:border-gray-900"></div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-40"></div>
              <div className="h-4 bg-primary/20 dark:bg-primary/10 rounded-full w-10"></div>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-12 flex-shrink-0"></div>
          </div>

          {/* 消息内容 */}
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-4/5"></div>
          </div>

          {/* 标签区域 */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="h-5 bg-primary/10 dark:bg-primary/5 rounded-full w-14"></div>
            <div className="h-5 bg-gray-100 dark:bg-white/5 rounded-full w-12"></div>
          </div>
        </div>

        {/* 右侧操作按钮占位 */}
        <div className="flex flex-col items-center gap-1 opacity-0">
          <div className="w-8 h-8 rounded-full"></div>
          <div className="w-8 h-8 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
