"use client";

import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TriggerButton } from "@/components/ui/trigger-button";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: Date;
  to?: Date;
}

interface DateRangePickerProps {
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const handleFromDateSelect = (date: Date | undefined) => {
    const newRange = { from: date, to: dateRange?.to };
    onDateRangeChange?.(newRange);
  };

  const handleToDateSelect = (date: Date | undefined) => {
    const newRange = { from: dateRange?.from, to: date };
    onDateRangeChange?.(newRange);
  };

  return (
    <div className={cn("w-full flex items-center gap-2", className)}>
      {/* From Date */}
      <div className="space-y-2 flex-1">
        <Label className="text-xs text-gray-500 dark:text-white/50">From</Label>
        <Popover>
          <PopoverTrigger asChild>
            <TriggerButton
              selected={!!dateRange?.from}
              size="sm"
              className="w-full"
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {dateRange?.from ? (
                format(dateRange.from, "MMM dd, yy")
              ) : (
                <span>Start date</span>
              )}
            </TriggerButton>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange?.from}
              onSelect={handleFromDateSelect}
              disabled={(date) =>
                dateRange?.to ? date > dateRange.to : false
              }
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* To Date */}
      <div className="space-y-2 flex-1">
        <Label className="text-xs text-gray-500 dark:text-white/50">To</Label>
        <Popover>
          <PopoverTrigger asChild>
            <TriggerButton
              selected={!!dateRange?.to}
              size="sm"
              className="w-full"
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {dateRange?.to ? (
                format(dateRange.to, "MMM dd, yy")
              ) : (
                <span>End date</span>
              )}
            </TriggerButton>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange?.to}
              onSelect={handleToDateSelect}
              disabled={(date) =>
                dateRange?.from ? date < dateRange.from : false
              }
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

