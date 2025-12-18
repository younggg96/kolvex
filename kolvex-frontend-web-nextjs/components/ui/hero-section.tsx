import React from "react";
import { LucideIcon } from "lucide-react";

export interface FeaturePill {
  icon: LucideIcon;
  label: string;
  iconClassName?: string;
}

export interface HeroSectionProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  features?: FeaturePill[];
  className?: string;
}

export function HeroSection({
  title,
  description,
  actions,
  features = [],
  className = "",
}: HeroSectionProps) {
  return (
    <div
      className={`relative overflow-hidden ${className} bg-card-light dark:bg-transparent p-4 border-b border-border-light dark:border-0 shadow-sm`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-gray-600 dark:text-white/60">
                {description}
              </p>
            )}
          </div>
        </div>
        {/* Actions */}
        {actions && <div>{actions}</div>}
      </div>

      {/* Feature Pills */}
      {features.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border-light dark:border-border-dark rounded-full"
              >
                <Icon className={feature.iconClassName || "w-3.5 h-3.5"} />
                <span className="text-xs font-medium text-gray-700 dark:text-white/70">
                  {feature.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
