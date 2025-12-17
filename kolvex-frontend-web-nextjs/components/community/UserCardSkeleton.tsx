"use client";

export function UserCardSkeleton() {
  return (
    <div className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-3 w-16 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="h-16 bg-gray-100 dark:bg-white/5 rounded-lg" />
        <div className="h-16 bg-gray-100 dark:bg-white/5 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-20 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-6 w-12 bg-gray-200 dark:bg-white/10 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
