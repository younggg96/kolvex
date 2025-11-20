"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TriggerButton } from "./trigger-button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface MultiSelectOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  maxVisibleTags?: number;
}

export const MultiSelect = React.forwardRef<HTMLDivElement, MultiSelectProps>(
  (
    {
      options,
      value = [],
      onChange,
      placeholder = "Select...",
      className,
      disabled = false,
      size = "md",
      maxVisibleTags = 3,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined);

    React.useEffect(() => {
      const updateWidth = () => {
        if (triggerRef.current) {
          setTriggerWidth(triggerRef.current.offsetWidth);
        }
      };

      updateWidth();
      
      // Update width when window resizes
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }, []);

    React.useEffect(() => {
      if (isOpen && triggerRef.current) {
        setTriggerWidth(triggerRef.current.offsetWidth);
      }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
      const newValue = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue];
      onChange(newValue);
    };

    const handleRemoveOption = (e: React.MouseEvent, optionValue: string) => {
      e.stopPropagation();
      const newValue = value.filter((v) => v !== optionValue);
      onChange(newValue);
    };

    const selectedOptions = options.filter((opt) =>
      value.includes(opt.value)
    );

    // Define min heights based on size
    const minHeightClasses = {
      sm: "min-h-[38px]",
      md: "min-h-[40px]",
      lg: "min-h-[48px]",
    };

    return (
      <div ref={ref} className={cn("relative w-full", className)}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <TriggerButton
              ref={triggerRef}
              disabled={disabled}
              selected={selectedOptions.length > 0}
              size={size}
              className={cn(
                "w-full justify-between h-auto py-1.5",
                minHeightClasses[size]
              )}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
            >
              <div className="flex-1 flex flex-wrap gap-1 items-center min-w-0">
                {selectedOptions.length === 0 ? (
                  <span className="text-gray-500 dark:text-white/50">{placeholder}</span>
                ) : (
                  <>
                    {selectedOptions.slice(0, maxVisibleTags).map((option) => (
                      <span
                        key={option.value}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        {option.icon && <span className="flex items-center">{option.icon}</span>}
                        <span className="truncate max-w-[120px]">{option.label}</span>
                        {!disabled && (
                          <button
                            onClick={(e) => handleRemoveOption(e, option.value)}
                            className="hover:bg-primary/20 rounded-full p-0.5 transition-colors flex-shrink-0"
                            aria-label={`Remove ${option.label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {selectedOptions.length > maxVisibleTags && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/70">
                        +{selectedOptions.length - maxVisibleTags} more
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 opacity-50 transition-transform duration-200",
                    isOpen && "transform rotate-180"
                  )} 
                />
              </div>
            </TriggerButton>
          </PopoverTrigger>
          <PopoverContent 
            className="p-0" 
            style={{ width: triggerWidth ? `${triggerWidth}px` : undefined }}
            align="start"
            sideOffset={4}
          >
            <div className="max-h-[168px] overflow-y-auto">
              <div className="p-1 flex flex-col gap-1">
                {options.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500 dark:text-white/50">
                    No options available
                  </div>
                ) : (
                  options.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <div
                        key={option.value}
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          "flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none transition-colors duration-150",
                          isSelected
                            ? "bg-primary/10 text-primary dark:bg-primary/20"
                            : "hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {option.icon && (
                            <span className="flex items-center">{option.icon}</span>
                          )}
                          <span>{option.label}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

MultiSelect.displayName = "MultiSelect";

