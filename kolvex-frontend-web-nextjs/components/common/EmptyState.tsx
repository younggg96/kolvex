/**
 * Empty State Components
 * 用于显示空状态和错误状态的组件
 */
"use client";
import { LucideIcon, Inbox, AlertCircle } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
      <Icon className="text-gray-300 dark:text-white/20 w-16 h-16 mb-4" />
      <h3 className="text-gray-800 dark:text-white/80 text-base font-semibold mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-600 dark:text-white/50 text-sm mb-4 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-primary dark:bg-primary text-white dark:text-background-dark text-sm font-medium rounded-lg hover:bg-primary/90 dark:hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  retry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
      <AlertCircle className="text-red-500 dark:text-red-500/80 w-16 h-16 mb-4" />
      <h3 className="text-gray-800 dark:text-white/80 text-base font-semibold mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-white/50 text-sm mb-4 max-w-md">
        {message}
      </p>
      {retry && (
        <button
          onClick={retry}
          className="px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
