"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { CommandSearch } from "@/components/ui/command-search";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  /** The box the field opens into (width classes go here). */
  containerClassName?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
  /** Short word on the folded pill. Defaults to "Search" / "搜索". */
  label?: React.ReactNode;
  /** Page-wide shortcut that opens this field, e.g. "mod+k". Give it to one search per page. */
  shortcut?: string;
}

const sizeConfig = {
  sm: {
    height: "h-8",
    input: "h-8 px-3 text-xs pl-8",
    icon: "w-3.5 h-3.5 left-2.5",
  },
  md: {
    height: "h-10",
    input: "h-10 px-4 text-sm pl-9",
    icon: "w-4 h-4 left-3",
  },
  lg: {
    height: "h-12",
    input: "h-12 px-6 text-base pl-11",
    icon: "w-5 h-5 left-3.5",
  },
};

export function SearchFieldIcon({ className = "left-3 h-4 w-4" }: { className?: string }) {
  return (
    <Search
      aria-hidden="true"
      data-slot="search-field-icon"
      className={cn(
        "pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-muted-foreground",
        className,
      )}
    />
  );
}

/** A search field that rests as a pill and springs open (see CommandSearch). */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    { className, containerClassName, iconClassName, size = "md", label, shortcut, ...props },
    ref,
  ) => {
    const { locale } = useTranslation();
    const config = sizeConfig[size];
    const hasValue = String(props.value ?? props.defaultValue ?? "").length > 0;

    return (
      <CommandSearch
        label={label ?? (locale === "zh" ? "搜索" : "Search")}
        hasValue={hasValue}
        shortcut={shortcut}
        heightClassName={config.height}
        className={cn("w-full", containerClassName)}
      >
        <div className="relative w-full rounded-full glass-field bg-foreground/[0.06] transition-colors duration-200 hover:bg-foreground/[0.09] focus-within:bg-foreground/[0.11]">
          <SearchFieldIcon className={cn(config.icon, iconClassName)} />
          <input
            ref={ref}
            type="text"
            className={cn(
              "w-full rounded-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground dark:placeholder:text-white/40 focus-visible:bg-transparent focus-visible:outline-none transition-colors duration-200",
              config.input,
              className,
            )}
            {...props}
          />
        </div>
      </CommandSearch>
    );
  },
);

SearchInput.displayName = "SearchInput";

export { SearchInput };
