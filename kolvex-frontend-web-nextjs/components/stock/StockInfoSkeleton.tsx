/**
 * StockInfoSkeleton - 股票信息侧边栏的骨架屏组件
 * 用于在数据加载时显示占位符
 */
export default function StockInfoSkeleton() {
  return (
    <div className="space-y-2">
      {/* Market Data Card Skeleton */}
      <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-3">
        <div className="space-y-4 animate-pulse">
          {/* Header: Symbol (text-lg) + Name (text-xs) */}
          <div>
            <div className="h-[18px] bg-gray-200 dark:bg-white/10 rounded w-14 mb-0.5" />
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-28" />
          </div>

          {/* Price (text-xl) + Change (text-xs) */}
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-16" />
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-20" />
          </div>

          {/* Statistics Grid - 2 cols, labels (text-[10px]) + values (text-xs) */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {[...Array(8)].map((_, i) => (
              <div key={i}>
                <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded w-12 mb-0.5" />
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-14" />
              </div>
            ))}
            {/* Market Cap - full width */}
            <div className="col-span-2">
              <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded w-14 mb-0.5" />
              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-16" />
            </div>
          </div>
        </div>
      </div>

      {/* Company Profile Card Skeleton */}
      <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="animate-pulse">
          {/* Accordion Header - px-3 py-2.5, title (text-xs) */}
          <div className="px-3 py-2.5 flex items-center justify-between">
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-20" />
            <div className="h-3 w-3 bg-gray-200 dark:bg-white/10 rounded" />
          </div>
          {/* Accordion Content - px-3 pb-3 */}
          <div className="px-3 pb-3">
            {/* Summary lines (text-xs) */}
            <div className="space-y-1">
              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-full" />
              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-full" />
              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
            </div>
            {/* Key info - pt-2, labels (text-[10px]) + values (text-xs) */}
            <div className="pt-2 mt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded w-10" />
                  <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Metrics Card Skeleton */}
      <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="animate-pulse">
          {/* Accordion Header - px-3 py-2.5, title (text-xs) */}
          <div className="px-3 py-2.5 flex items-center justify-between">
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-24" />
            <div className="h-3 w-3 bg-gray-200 dark:bg-white/10 rounded" />
          </div>
          {/* Accordion Content - px-3 pb-3, labels (text-[10px]) + values (text-xs) */}
          <div className="px-3 pb-3 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded w-16" />
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
