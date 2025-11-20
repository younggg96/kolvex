"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TriggerButton } from "./trigger-button";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface Option {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface ExpandableOptionsProps {
  options: Option[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  defaultVisibleCount?: number;
  columns?: number;
  className?: string;
  expandButtonHeight?: string;
  blurOpacity?: number;
}

export function ExpandableOptions({
  options,
  selectedValues,
  onSelectionChange,
  defaultVisibleCount = 6,
  columns = 3,
  className,
  expandButtonHeight = "h-[60px]",
  blurOpacity = 80,
}: ExpandableOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = options.length > defaultVisibleCount;
  const visibleOptions = isExpanded ? options : options.slice(0, defaultVisibleCount);

  const handleToggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  // Map columns to Tailwind grid classes
  const getGridClass = (cols: number) => {
    const gridClasses: Record<number, string> = {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
      5: "grid-cols-5",
      6: "grid-cols-6",
    };
    return gridClasses[cols] || "grid-cols-3";
  };

  const gridClass = getGridClass(columns);

  return (
    <div className={cn("relative", className)}>
      {/* Options Grid */}
      <div className={cn("grid gap-2", gridClass)}>
        {visibleOptions.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <TriggerButton
              key={option.value}
              onClick={() => handleToggleOption(option.value)}
              selected={isSelected}
              size="sm"
              className="w-full justify-start"
              title={option.label}
            >
              {option.icon && (
                <span className="flex items-center mr-1 flex-shrink-0">
                  {option.icon}
                </span>
              )}
              <span className="truncate text-xs">{option.label}</span>
            </TriggerButton>
          );
        })}
      </div>

      {/* Expand/Collapse Section */}
      {hasMore && !isExpanded && (
        <div className={cn("relative mt-2", expandButtonHeight)}>
          {/* Blurred Preview of Remaining Options */}
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className={cn("grid gap-2 blur-sm", gridClass)}
              style={{ opacity: blurOpacity / 100 }}
            >
              {options.slice(defaultVisibleCount).map((option) => (
                <div
                  key={option.value}
                  className="h-8 rounded-md bg-gray-200 dark:bg-white/10"
                />
              ))}
            </div>
          </div>

          {/* Expand Button */}
          <Button
            variant="link"
            size="xs"
            onClick={() => setIsExpanded(true)}
            className="absolute top-1/2 -translate-y-1/2 inset-0 flex items-center justify-center backdrop-blur-sm"
          >
            Show all ({options.length - defaultVisibleCount} more)
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Collapse Button */}
      {hasMore && isExpanded && (
        <div className="mt-2">
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Show less
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
