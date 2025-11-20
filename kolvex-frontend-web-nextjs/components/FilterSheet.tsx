"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TriggerButton } from "@/components/ui/trigger-button";
import {
  Filter,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { MultiSelectOption } from "@/components/ui/multi-select";
import { ExpandableOptions } from "@/components/ui/expandable-options";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";

// Re-export DateRange and Sentiment for consumers
export type { DateRange };

export type Sentiment = "bullish" | "bearish" | "neutral";

interface FilterSheetProps {
  // Author filters
  authorOptions: MultiSelectOption[];
  selectedAuthors: string[];
  onAuthorsChange: (authors: string[]) => void;

  // Tag filters
  tagOptions: MultiSelectOption[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;

  // Sentiment filters
  selectedSentiments: Sentiment[];
  onSentimentsChange: (sentiments: Sentiment[]) => void;

  // Time range filters
  timeRange: string;
  onTimeRangeChange: (range: string) => void;

  // Custom date range
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;

  // Filter count for badge
  activeFilterCount?: number;
}

const timeRangeOptions = [
  { label: "All Time", value: "all" },
  { label: "Last Hour", value: "1h" },
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
];

const sentimentOptions = [
  {
    label: "Bullish",
    value: "bullish" as Sentiment,
    icon: TrendingUp,
    iconColor: "text-green-500",
    variant: "green" as const,
  },
  {
    label: "Bearish",
    value: "bearish" as Sentiment,
    icon: TrendingDown,
    iconColor: "text-red-500",
    variant: "red" as const,
  },
  {
    label: "Neutral",
    value: "neutral" as Sentiment,
    icon: Minus,
    iconColor: "text-gray-500 dark:text-gray-400",
    variant: "gray" as const,
  },
];

export function FilterSheet({
  authorOptions,
  selectedAuthors,
  onAuthorsChange,
  tagOptions,
  selectedTags,
  onTagsChange,
  selectedSentiments,
  onSentimentsChange,
  timeRange,
  onTimeRangeChange,
  dateRange,
  onDateRangeChange,
  activeFilterCount = 0,
}: FilterSheetProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleReset = () => {
    onTimeRangeChange("all");
    onDateRangeChange?.(undefined);
  };

  const toggleSentiment = (sentiment: Sentiment) => {
    if (selectedSentiments.includes(sentiment)) {
      onSentimentsChange(selectedSentiments.filter((s) => s !== sentiment));
    } else {
      onSentimentsChange([...selectedSentiments, sentiment]);
    }
  };

  // Handle Time Range option click - clear DateRangePicker when option is selected
  const handleTimeRangeOptionClick = (value: string) => {
    onDateRangeChange?.(undefined); // Clear DateRangePicker
    onTimeRangeChange(value);
  };

  // Handle DateRangePicker change - clear Time Range option when date is picked
  const handleDateRangeChange = (range: DateRange | undefined) => {
    onDateRangeChange?.(range);
    if (range?.from || range?.to) {
      onTimeRangeChange(""); // Clear Time Range option selection
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          aria-label="Open filters"
        >
          <Filter className="w-3 h-3" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full xs:max-w-md flex flex-col !py-6 !px-4"
      >
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Customize what posts you want to see
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Author Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between h-6">
              <Label className="text-base font-semibold">Authors</Label>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedAuthors.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-white/50">
                    {selectedAuthors.length} selected
                  </span>
                )}
                {selectedAuthors.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!p-0 !w-6 !h-6"
                    onClick={() => onAuthorsChange([])}
                    aria-label="Clear authors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            {authorOptions.length > 0 ? (
              <ExpandableOptions
                options={authorOptions}
                selectedValues={selectedAuthors}
                onSelectionChange={onAuthorsChange}
                defaultVisibleCount={6}
                columns={2}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-white/50">
                No authors available for this platform
              </p>
            )}
          </div>

          <Separator />

          {/* Tag Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between h-6">
              <Label className="text-base font-semibold">Tags</Label>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedTags.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-white/50">
                    {selectedTags.length} selected
                  </span>
                )}
                {selectedTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!p-0 !w-6 !h-6"
                    onClick={() => onTagsChange([])}
                    aria-label="Clear tags"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            {tagOptions.length > 0 ? (
              <ExpandableOptions
                options={tagOptions}
                selectedValues={selectedTags}
                onSelectionChange={onTagsChange}
                defaultVisibleCount={6}
                columns={3}
                expandButtonHeight="h-[40px]"
                blurOpacity={80}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-white/50">
                No tags available for this platform
              </p>
            )}
          </div>

          <Separator />

          {/* Sentiment Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between h-6">
              <Label className="text-base font-semibold">Sentiment</Label>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedSentiments.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-white/50">
                    {selectedSentiments.length} selected
                  </span>
                )}
                {selectedSentiments.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!p-0 !w-6 !h-6"
                    onClick={() => onSentimentsChange([])}
                    aria-label="Clear sentiments"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {sentimentOptions.map((option) => {
                const IconComponent = option.icon;
                const isSelected = selectedSentiments.includes(option.value);
                return (
                  <TriggerButton
                    key={option.value}
                    onClick={() => toggleSentiment(option.value)}
                    selected={isSelected}
                    size="sm"
                    variant={option.variant}
                    className="w-full flex items-center justify-center gap-1"
                  >
                    <IconComponent className={`w-3 h-3 ${option.iconColor}`} />
                    <span className="text-xs">{option.label}</span>
                  </TriggerButton>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Time Range Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between h-6">
              <Label className="text-base font-semibold">Time Range</Label>
              {timeRange !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="!p-0 !w-6 !h-6"
                  onClick={handleReset}
                  aria-label="Reset filters"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {timeRangeOptions.map((option) => (
                <TriggerButton
                  key={option.value}
                  onClick={() => handleTimeRangeOptionClick(option.value)}
                  selected={timeRange === option.value}
                  size="sm"
                  className="w-full"
                >
                  {option.label}
                </TriggerButton>
              ))}
            </div>

            {/* Custom Date Range Picker */}
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
