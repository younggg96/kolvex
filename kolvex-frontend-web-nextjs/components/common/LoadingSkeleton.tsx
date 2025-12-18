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

// 通知项骨架屏
export function NotificationItemSkeleton() {
  return (
    <div className="px-4 py-4 animate-pulse border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className="flex items-start gap-4">
        {/* Icon Skeleton */}
        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0 mt-0.5"></div>

        {/* Content Skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-16"></div>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-5/6"></div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="h-5 bg-gray-200 dark:bg-white/5 rounded-md w-14"></div>
            <div className="h-5 bg-gray-200 dark:bg-white/5 rounded w-10"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
